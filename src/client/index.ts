import { httpActionGeneric } from "convex/server";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export type PaystackOptions = {
  secretKey: string;
};

export type InitializeTransactionArgs = {
  email: string;
  amount: number;
  currency?: string;
  callbackUrl?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type InitializeTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export type VerifyTransactionResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  gatewayResponse?: string;
  paidAt?: number;
  authorizationCode?: string;
  customerEmail: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class Paystack {
  webhookHandler: ReturnType<typeof httpActionGeneric>;

  constructor(
    private component: ComponentApi,
    private options: PaystackOptions,
  ) {
    const component_ = component;
    const secretKey = options.secretKey;

    this.webhookHandler = httpActionGeneric(async (ctx, request) => {
      const rawBody = await request.text();
      const signature = request.headers.get("x-paystack-signature");

      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const expected = await hmacSha512Hex(secretKey, rawBody);
      if (!timingSafeEqual(expected, signature)) {
        console.error("convex-paystack: webhook signature mismatch");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let event: { event: string; data: Record<string, unknown> };
      try {
        event = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = event.data ?? {};
      const eventId =
        data.id !== undefined
          ? `${event.event}:${data.id}`
          : `${event.event}:${(data.reference as string) ?? (data.subscription_code as string) ?? crypto.randomUUID()}`;

      const { alreadyProcessed } = await ctx.runMutation(component_.lib.checkAndRecordEvent, {
        eventId,
        eventType: event.event,
        reference: (data.reference as string) ?? undefined,
        payload: rawBody,
      });

      if (alreadyProcessed) {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      switch (event.event) {
        case "charge.success": {
          const customer = data.customer as Record<string, unknown> | undefined;
          const authorization = data.authorization as Record<string, unknown> | undefined;
          await ctx.runMutation(component_.lib.recordTransaction, {
            reference: data.reference as string,
            customerEmail: (customer?.email as string) ?? "",
            amount: data.amount as number,
            currency: (data.currency as string) ?? "NGN",
            status: "success",
            channel: (data.channel as string) ?? undefined,
            gatewayResponse: (data.gateway_response as string) ?? undefined,
            authorizationCode: (authorization?.authorization_code as string) ?? undefined,
            paidAt: data.paid_at ? new Date(data.paid_at as string).getTime() : undefined,
            metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          });
          break;
        }
        case "subscription.create": {
          const customer = data.customer as Record<string, unknown> | undefined;
          const plan = data.plan as Record<string, unknown> | undefined;
          await ctx.runMutation(component_.lib.recordSubscriptionEvent, {
            subscriptionCode: data.subscription_code as string,
            emailToken: (data.email_token as string) ?? undefined,
            customerEmail: (customer?.email as string) ?? "",
            customerCode: (customer?.customer_code as string) ?? undefined,
            planCode: (plan?.plan_code as string) ?? "",
            status: (data.status as string as
              | "active"
              | "non-renewing"
              | "attention"
              | "completed"
              | "cancelled") ?? "active",
            amount: (data.amount as number) ?? undefined,
            nextPaymentDate: data.next_payment_date
              ? new Date(data.next_payment_date as string).getTime()
              : undefined,
          });
          break;
        }
        case "subscription.disable": {
          await ctx.runMutation(component_.lib.updateSubscriptionStatus, {
            subscriptionCode: data.subscription_code as string,
            status: "cancelled",
          });
          break;
        }
        case "subscription.not_renew": {
          await ctx.runMutation(component_.lib.updateSubscriptionStatus, {
            subscriptionCode: data.subscription_code as string,
            status: "non-renewing",
          });
          break;
        }
        case "invoice.update": {
          const subscription = data.subscription as Record<string, unknown> | undefined;
          const subscriptionCode = subscription?.subscription_code as string | undefined;
          if (subscriptionCode) {
            await ctx.runMutation(component_.lib.updateSubscriptionStatus, {
              subscriptionCode,
              status: data.status === "success" ? "active" : "attention",
            });
          }
          break;
        }
        default:
          break;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  async initializeTransaction(
    ctx: GenericActionCtx<GenericDataModel>,
    args: InitializeTransactionArgs,
  ): Promise<InitializeTransactionResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: args.email,
        amount: args.amount,
        currency: args.currency,
        callback_url: args.callbackUrl,
        reference: args.reference,
        metadata: args.metadata,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data: { authorization_url: string; access_code: string; reference: string };
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to initialize Paystack transaction");
    }

    await ctx.runMutation(this.component.lib.recordTransaction, {
      reference: json.data.reference,
      customerEmail: args.email,
      amount: args.amount,
      currency: args.currency ?? "NGN",
      status: "pending",
      metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    });

    return {
      authorizationUrl: json.data.authorization_url,
      accessCode: json.data.access_code,
      reference: json.data.reference,
    };
  }

  async verifyTransaction(
    ctx: GenericActionCtx<GenericDataModel>,
    args: { reference: string },
  ): Promise<VerifyTransactionResult> {
    const res = await fetch(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(args.reference)}`,
      { headers: { Authorization: `Bearer ${this.options.secretKey}` } },
    );
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
        channel?: string;
        gateway_response?: string;
        paid_at?: string;
        authorization?: { authorization_code?: string };
        customer?: { email?: string };
      };
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to verify Paystack transaction");
    }
    const data = json.data;

    await ctx.runMutation(this.component.lib.recordTransaction, {
      reference: data.reference,
      customerEmail: data.customer?.email ?? "",
      amount: data.amount,
      currency: data.currency,
      status: data.status as "pending" | "success" | "failed" | "abandoned",
      channel: data.channel ?? undefined,
      gatewayResponse: data.gateway_response ?? undefined,
      authorizationCode: data.authorization?.authorization_code ?? undefined,
      paidAt: data.paid_at ? new Date(data.paid_at).getTime() : undefined,
    });

    return {
      status: data.status,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel ?? undefined,
      gatewayResponse: data.gateway_response ?? undefined,
      paidAt: data.paid_at ? new Date(data.paid_at).getTime() : undefined,
      authorizationCode: data.authorization?.authorization_code ?? undefined,
      customerEmail: data.customer?.email ?? "",
    };
  }

  async cancelSubscription(
    ctx: GenericActionCtx<GenericDataModel>,
    args: { code: string; token: string },
  ): Promise<void> {
    const res = await fetch(`${PAYSTACK_API_BASE}/subscription/disable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: args.code, token: args.token }),
    });
    const json = (await res.json()) as { status: boolean; message?: string };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to cancel Paystack subscription");
    }
    await ctx.runMutation(this.component.lib.updateSubscriptionStatus, {
      subscriptionCode: args.code,
      status: "cancelled",
    });
  }

  async enableSubscription(
    ctx: GenericActionCtx<GenericDataModel>,
    args: { code: string; token: string },
  ): Promise<void> {
    const res = await fetch(`${PAYSTACK_API_BASE}/subscription/enable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: args.code, token: args.token }),
    });
    const json = (await res.json()) as { status: boolean; message?: string };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to enable Paystack subscription");
    }
    await ctx.runMutation(this.component.lib.updateSubscriptionStatus, {
      subscriptionCode: args.code,
      status: "active",
    });
  }

  async getTransaction(ctx: RunQueryCtx, args: { reference: string }) {
    return await ctx.runQuery(this.component.lib.getTransaction, args);
  }

  async listTransactions(ctx: RunQueryCtx, args: { customerEmail: string; limit?: number }) {
    return await ctx.runQuery(this.component.lib.listTransactions, args);
  }

  async getSubscription(ctx: RunQueryCtx, args: { subscriptionCode: string }) {
    return await ctx.runQuery(this.component.lib.getSubscription, args);
  }

  async listSubscriptions(ctx: RunQueryCtx, args: { customerEmail: string }) {
    return await ctx.runQuery(this.component.lib.listSubscriptions, args);
  }

  async hasActiveSubscription(ctx: RunQueryCtx, args: { customerEmail: string }): Promise<boolean> {
    return await ctx.runQuery(this.component.lib.hasActiveSubscription, args);
  }
}

type RunQueryCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
};
