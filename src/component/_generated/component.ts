/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      checkAndRecordEvent: FunctionReference<
        "mutation",
        "internal",
        {
          eventId: string;
          eventType: string;
          payload: string;
          reference?: string;
        },
        { alreadyProcessed: boolean },
        Name
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { subscriptionCode: string },
        null | {
          _creationTime: number;
          _id: string;
          amount?: number;
          createdAt: number;
          customerCode?: string;
          customerEmail: string;
          emailToken?: string;
          nextPaymentDate?: number;
          planCode: string;
          status:
            | "active"
            | "non-renewing"
            | "attention"
            | "completed"
            | "cancelled";
          subscriptionCode: string;
          updatedAt: number;
        },
        Name
      >;
      getTransaction: FunctionReference<
        "query",
        "internal",
        { reference: string },
        null | {
          _creationTime: number;
          _id: string;
          amount: number;
          authorizationCode?: string;
          channel?: string;
          createdAt: number;
          currency: string;
          customerEmail: string;
          gatewayResponse?: string;
          metadata?: string;
          paidAt?: number;
          reference: string;
          status: "pending" | "success" | "failed" | "abandoned";
          updatedAt: number;
        },
        Name
      >;
      hasActiveSubscription: FunctionReference<
        "query",
        "internal",
        { customerEmail: string },
        boolean,
        Name
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { customerEmail: string },
        Array<{
          _creationTime: number;
          _id: string;
          amount?: number;
          createdAt: number;
          customerCode?: string;
          customerEmail: string;
          emailToken?: string;
          nextPaymentDate?: number;
          planCode: string;
          status:
            | "active"
            | "non-renewing"
            | "attention"
            | "completed"
            | "cancelled";
          subscriptionCode: string;
          updatedAt: number;
        }>,
        Name
      >;
      listTransactions: FunctionReference<
        "query",
        "internal",
        { customerEmail: string; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          amount: number;
          authorizationCode?: string;
          channel?: string;
          createdAt: number;
          currency: string;
          customerEmail: string;
          gatewayResponse?: string;
          metadata?: string;
          paidAt?: number;
          reference: string;
          status: "pending" | "success" | "failed" | "abandoned";
          updatedAt: number;
        }>,
        Name
      >;
      recordSubscriptionEvent: FunctionReference<
        "mutation",
        "internal",
        {
          amount?: number;
          customerCode?: string;
          customerEmail: string;
          emailToken?: string;
          nextPaymentDate?: number;
          planCode: string;
          status:
            | "active"
            | "non-renewing"
            | "attention"
            | "completed"
            | "cancelled";
          subscriptionCode: string;
        },
        string,
        Name
      >;
      recordTransaction: FunctionReference<
        "mutation",
        "internal",
        {
          amount: number;
          authorizationCode?: string;
          channel?: string;
          currency: string;
          customerEmail: string;
          gatewayResponse?: string;
          metadata?: string;
          paidAt?: number;
          reference: string;
          status: "pending" | "success" | "failed" | "abandoned";
        },
        string,
        Name
      >;
      updateSubscriptionStatus: FunctionReference<
        "mutation",
        "internal",
        {
          status:
            | "active"
            | "non-renewing"
            | "attention"
            | "completed"
            | "cancelled";
          subscriptionCode: string;
        },
        null,
        Name
      >;
    };
  };
