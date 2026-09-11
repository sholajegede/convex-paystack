import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  transactions: defineTable({
    reference: v.string(),
    customerEmail: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("abandoned"),
    ),
    channel: v.optional(v.string()),
    gatewayResponse: v.optional(v.string()),
    authorizationCode: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reference", ["reference"])
    .index("by_customerEmail", ["customerEmail"]),

  subscriptions: defineTable({
    subscriptionCode: v.string(),
    emailToken: v.optional(v.string()),
    customerEmail: v.string(),
    customerCode: v.optional(v.string()),
    planCode: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("non-renewing"),
      v.literal("attention"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    amount: v.optional(v.number()),
    nextPaymentDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subscriptionCode", ["subscriptionCode"])
    .index("by_customerEmail", ["customerEmail"])
    .index("by_status", ["status"]),

  webhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    reference: v.optional(v.string()),
    payload: v.string(),
    receivedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_eventType", ["eventType"]),
});
