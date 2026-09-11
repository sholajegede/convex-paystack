import { describe, expect, test } from "vitest";
import { initConvexTest } from "./setup.test.js";
import { api } from "./_generated/api.js";

describe("transactions", () => {
  test("recordTransaction inserts then updates the same reference", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTransaction, {
      reference: "ref_123",
      customerEmail: "dev@sholajegede.com",
      amount: 500000,
      currency: "NGN",
      status: "pending",
    });

    let tx = await t.query(api.lib.getTransaction, { reference: "ref_123" });
    expect(tx?.status).toBe("pending");

    await t.mutation(api.lib.recordTransaction, {
      reference: "ref_123",
      customerEmail: "dev@sholajegede.com",
      amount: 500000,
      currency: "NGN",
      status: "success",
      channel: "card",
    });

    tx = await t.query(api.lib.getTransaction, { reference: "ref_123" });
    expect(tx?.status).toBe("success");
    expect(tx?.channel).toBe("card");
  });

  test("listTransactions returns only the given customer's transactions", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordTransaction, {
      reference: "ref_a",
      customerEmail: "a@example.com",
      amount: 1000,
      currency: "NGN",
      status: "success",
    });
    await t.mutation(api.lib.recordTransaction, {
      reference: "ref_b",
      customerEmail: "b@example.com",
      amount: 2000,
      currency: "NGN",
      status: "success",
    });

    const results = await t.query(api.lib.listTransactions, {
      customerEmail: "a@example.com",
    });
    expect(results).toHaveLength(1);
    expect(results[0].reference).toBe("ref_a");
  });
});

describe("subscriptions", () => {
  test("recordSubscriptionEvent upserts by subscriptionCode", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.recordSubscriptionEvent, {
      subscriptionCode: "SUB_123",
      customerEmail: "dev@sholajegede.com",
      planCode: "PLN_pro",
      status: "active",
    });

    expect(
      await t.query(api.lib.hasActiveSubscription, {
        customerEmail: "dev@sholajegede.com",
      }),
    ).toBe(true);

    await t.mutation(api.lib.updateSubscriptionStatus, {
      subscriptionCode: "SUB_123",
      status: "cancelled",
    });

    expect(
      await t.query(api.lib.hasActiveSubscription, {
        customerEmail: "dev@sholajegede.com",
      }),
    ).toBe(false);
  });
});

describe("webhook idempotency", () => {
  test("checkAndRecordEvent flags duplicate event ids", async () => {
    const t = initConvexTest();

    const first = await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "charge.success:12345",
      eventType: "charge.success",
      reference: "ref_123",
      payload: "{}",
    });
    expect(first.alreadyProcessed).toBe(false);

    const second = await t.mutation(api.lib.checkAndRecordEvent, {
      eventId: "charge.success:12345",
      eventType: "charge.success",
      reference: "ref_123",
      payload: "{}",
    });
    expect(second.alreadyProcessed).toBe(true);
  });
});
