import { query, action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { Paystack } from "../../src/client/index.js";
import { v } from "convex/values";

const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

const channelValidator = v.union(
  v.literal("card"),
  v.literal("bank"),
  v.literal("apple_pay"),
  v.literal("ussd"),
  v.literal("qr"),
  v.literal("mobile_money"),
  v.literal("bank_transfer"),
  v.literal("eft"),
  v.literal("capitec_pay"),
  v.literal("payattitude"),
);

// ─── One-time payments ──────────────────────────────────────────────────────

export const initializeTransaction = action({
  args: {
    email: v.string(),
    amount: v.number(),
    currency: v.optional(v.string()),
    channels: v.optional(v.array(channelValidator)),
    plan: v.optional(v.string()),
    callbackUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await paystack.initializeTransaction(ctx, args);
  },
});

export const verifyTransaction = action({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await paystack.verifyTransaction(ctx, args);
  },
});

export const getTransaction = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await paystack.getTransaction(ctx, args);
  },
});

export const listTransactions = query({
  args: { customerEmail: v.string() },
  handler: async (ctx, args) => {
    return await paystack.listTransactions(ctx, args);
  },
});

/** Powers the demo's live developer console. */
export const listRecentEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await paystack.listRecentEvents(ctx, args);
  },
});

/** Powers the header's live stat badges. */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    return await paystack.getStats(ctx);
  },
});

/**
 * Only currencies with a balance entry on this Paystack account will
 * actually accept a charge — everything else fails with "Currency not
 * supported by merchant". Falls back to NGN alone if the key can't read
 * balances, rather than failing the whole picker.
 */
export const listEnabledCurrencies = action({
  args: {},
  handler: async (ctx) => {
    try {
      const balances = await paystack.listBalances(ctx);
      const currencies = balances.map((b) => b.currency);
      return currencies.length > 0 ? currencies : ["NGN"];
    } catch {
      return ["NGN"];
    }
  },
});

/**
 * Convex's site URL for this deployment — this is what your webhook URL
 * in the Paystack Dashboard should point to. Surfaced in the UI because
 * "subscription never shows up" almost always means this hasn't been
 * registered yet for the current deployment.
 */
export const getWebhookUrl = query({
  args: {},
  handler: async () => {
    const site = process.env.CONVEX_SITE_URL;
    return site ? `${site}/webhooks/paystack` : null;
  },
});

// ─── Subscriptions ──────────────────────────────────────────────────────────

const DEMO_PLANS: Array<{
  key: "monthly" | "yearly";
  name: string;
  amount: number;
  interval: "monthly" | "annually";
  description: string;
}> = [
  {
    key: "monthly",
    name: "Convex + Paystack Demo — Monthly",
    amount: 500000, // ₦5,000.00 in kobo
    interval: "monthly",
    description: "Demo subscription plan billed every month.",
  },
  {
    key: "yearly",
    name: "Convex + Paystack Demo — Yearly",
    amount: 5000000, // ₦50,000.00 in kobo (2 months free vs. monthly)
    interval: "annually",
    description: "Demo subscription plan billed every year.",
  },
];

/**
 * Bootstraps the two demo plans on first run so the example app has
 * something real to subscribe to, without requiring manual setup in the
 * Paystack dashboard. Safe to call repeatedly — it reuses existing plans
 * by name instead of creating duplicates.
 */
export const ensureDemoPlans = action({
  args: {},
  handler: async (ctx) => {
    const existing = await paystack.listPlans(ctx);
    const results: Record<string, { planCode: string; name: string; amount: number; interval: string }> = {};

    for (const plan of DEMO_PLANS) {
      const match = existing.find((p) => p.name === plan.name);
      if (match) {
        results[plan.key] = match;
        continue;
      }
      const created = await paystack.createPlan(ctx, {
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval,
        currency: "NGN",
        description: plan.description,
      });
      results[plan.key] = created;
    }

    return results;
  },
});

/**
 * Reconciles a customer's subscriptions straight from Paystack, so the
 * demo shows the right state immediately after checkout even if the
 * `subscription.create` webhook hasn't reached this deployment yet (for
 * example because its URL isn't registered in the Paystack Dashboard).
 * Returns how many subscriptions were found and synced.
 */
export const syncSubscriptions = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await paystack.syncCustomerSubscriptions(ctx, { email: args.email });
  },
});

export const listSubscriptions = query({
  args: { customerEmail: v.string() },
  handler: async (ctx, args) => {
    return await paystack.listSubscriptions(ctx, args);
  },
});

export const hasActiveSubscription = query({
  args: { customerEmail: v.string() },
  handler: async (ctx, args) => {
    return await paystack.hasActiveSubscription(ctx, args);
  },
});

export const cancelSubscription = action({
  args: { code: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    await paystack.cancelSubscription(ctx, args);
    return null;
  },
});
