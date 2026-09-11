import { query, action } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { Paystack } from "../../src/client/index.js";
import { v } from "convex/values";

const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const initializeTransaction = action({
  args: {
    email: v.string(),
    amount: v.number(),
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
