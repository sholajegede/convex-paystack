import { httpActionGeneric } from "convex/server";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export type PaystackOptions = {
  secretKey: string;
};

export type PaystackChannel =
  | "card"
  | "bank"
  | "apple_pay"
  | "ussd"
  | "qr"
  | "mobile_money"
  | "bank_transfer"
  | "eft"
  | "capitec_pay"
  | "payattitude";

export type InitializeTransactionArgs = {
  email: string;
  amount: number;
  currency?: string;
  callbackUrl?: string;
  reference?: string;
  channels?: PaystackChannel[];
  plan?: string;
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

export type PlanInterval =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "biannually"
  | "annually";

export type CreatePlanArgs = {
  name: string;
  amount: number;
  interval: PlanInterval;
  currency?: string;
  description?: string;
};

export type PlanResult = {
  planCode: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
  description?: string;
};

export type Balance = {
  currency: string;
  balance: number;
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

function planFromPaystack(plan: Record<string, unknown>): PlanResult {
  return {
    planCode: plan.plan_code as string,
    name: plan.name as string,
    amount: plan.amount as number,
    interval: plan.interval as string,
    currency: (plan.currency as string) ?? "NGN",
    description: (plan.description as string) ?? undefined,
  };
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
        case "invoice.payment_failed": {
          const subscription = data.subscription as Record<string, unknown> | undefined;
          const subscriptionCode = subscription?.subscription_code as string | undefined;
          if (subscriptionCode) {
            await ctx.runMutation(component_.lib.updateSubscriptionStatus, {
              subscriptionCode,
              status: "attention",
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
        channels: args.channels,
        plan: args.plan,
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

  /**
   * Create a Paystack billing plan. Plans are the foundation for
   * subscriptions: pass the returned `planCode` as `plan` to
   * `initializeTransaction` to start a subscription on first payment.
   */
  async createPlan(
    ctx: GenericActionCtx<GenericDataModel>,
    args: CreatePlanArgs,
  ): Promise<PlanResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        amount: args.amount,
        interval: args.interval,
        currency: args.currency,
        description: args.description,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data: Record<string, unknown>;
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to create Paystack plan");
    }
    return planFromPaystack(json.data);
  }

  /**
   * Lists the currencies this Paystack account actually has enabled, with
   * their current balance. Use this to build a currency picker that only
   * ever offers currencies that will really work — `initializeTransaction`
   * throws "Currency not supported by merchant" for anything else.
   * Requires the secret key to have balance-read access; if it doesn't,
   * catch the error and fall back to your account's default currency.
   */
  async listBalances(_ctx: GenericActionCtx<GenericDataModel>): Promise<Balance[]> {
    const res = await fetch(`${PAYSTACK_API_BASE}/balance`, {
      headers: { Authorization: `Bearer ${this.options.secretKey}` },
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data: Balance[];
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to fetch Paystack balance");
    }
    return json.data;
  }

  /**
   * Fetches a customer's subscriptions directly from Paystack (via the
   * Fetch Customer endpoint, which returns them inline) and upserts each
   * one locally. A checkout initialized with `plan` starts a subscription
   * on Paystack's side immediately, but this component only learns about
   * it when the `subscription.create` webhook arrives — which, in local
   * development, requires that webhook URL to actually be registered in
   * the Paystack Dashboard. Call this right after a subscription checkout
   * returns to reconcile state even if that webhook hasn't fired yet.
   * Returns the number of subscriptions synced.
   */
  async syncCustomerSubscriptions(
    ctx: GenericActionCtx<GenericDataModel>,
    args: { email: string },
  ): Promise<number> {
    const res = await fetch(
      `${PAYSTACK_API_BASE}/customer/${encodeURIComponent(args.email)}`,
      { headers: { Authorization: `Bearer ${this.options.secretKey}` } },
    );
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { subscriptions?: Record<string, unknown>[] };
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to fetch Paystack customer");
    }

    const subscriptions = json.data?.subscriptions ?? [];
    for (const sub of subscriptions) {
      const plan = sub.plan as Record<string, unknown> | undefined;
      const customer = sub.customer as Record<string, unknown> | undefined;
      await ctx.runMutation(this.component.lib.recordSubscriptionEvent, {
        subscriptionCode: sub.subscription_code as string,
        emailToken: (sub.email_token as string) ?? undefined,
        customerEmail: args.email,
        customerCode: (customer?.customer_code as string) ?? undefined,
        planCode: (plan?.plan_code as string) ?? "",
        status: (sub.status as string as
          | "active"
          | "non-renewing"
          | "attention"
          | "completed"
          | "cancelled") ?? "active",
        amount: (sub.amount as number) ?? (plan?.amount as number) ?? undefined,
        nextPaymentDate: sub.next_payment_date
          ? new Date(sub.next_payment_date as string).getTime()
          : undefined,
      });
    }
    return subscriptions.length;
  }

  /** List billing plans already created on this Paystack account. */
  async listPlans(_ctx: GenericActionCtx<GenericDataModel>): Promise<PlanResult[]> {
    const res = await fetch(`${PAYSTACK_API_BASE}/plan?perPage=100`, {
      headers: { Authorization: `Bearer ${this.options.secretKey}` },
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data: Record<string, unknown>[];
    };
    if (!json.status) {
      throw new Error(json.message ?? "Failed to list Paystack plans");
    }
    return json.data.map(planFromPaystack);
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

  /**
   * Reads the raw webhook event log, newest first — every event Paystack
   * has sent this component, whether or not it changed local state.
   * Handy for an audit trail or a live "what just happened" console.
   */
  async listRecentEvents(ctx: RunQueryCtx, args?: { limit?: number }) {
    return await ctx.runQuery(this.component.lib.listRecentEvents, args ?? {});
  }

  /** Aggregate row counts — see {@link ComponentApi}'s `lib.getStats`. */
  async getStats(ctx: RunQueryCtx) {
    return await ctx.runQuery(this.component.lib.getStats, {});
  }
}

type RunQueryCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
};
