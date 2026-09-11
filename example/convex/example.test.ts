import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "../../src/component/schema.js";

const modules = import.meta.glob("./**/*.ts");
const componentModules = import.meta.glob("../../src/component/**/*.ts");

function initConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("convexPaystack", schema, componentModules);
  return t;
}

test("hasActiveSubscription returns false for unknown customer", async () => {
  const t = initConvexTest();
  const result = await t.query(api.example.hasActiveSubscription, {
    customerEmail: "unknown@example.com",
  });
  expect(result).toBe(false);
});

test("getTransaction returns null for unknown reference", async () => {
  const t = initConvexTest();
  const result = await t.query(api.example.getTransaction, {
    reference: "ref_unknown",
  });
  expect(result).toBe(null);
});
