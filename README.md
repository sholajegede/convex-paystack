# convex-paystack

**Accept payments and subscriptions with Paystack in your Convex app.** Reactive transactions, subscription state, and webhook ingestion.

[![npm version](https://img.shields.io/npm/v/convex-paystack)](https://www.npmjs.com/package/convex-paystack)
[![Convex Component](https://www.convex.dev/components/badge/sholajegede/convex-paystack)](https://www.convex.dev/components/sholajegede/convex-paystack)
[![npm downloads](https://img.shields.io/npm/dw/convex-paystack)](https://www.npmjs.com/package/convex-paystack)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

```ts
const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

// Start a checkout
const { authorizationUrl } = await paystack.initializeTransaction(ctx, {
  email: "customer@example.com",
  amount: 500000, // kobo
});

// Confirm it server-side after redirect
const result = await paystack.verifyTransaction(ctx, { reference });

// Is this customer on an active subscription?
const active = await paystack.hasActiveSubscription(ctx, { customerEmail: "customer@example.com" });
```

## What this does

Paystack fires webhook events every time a payment or subscription action happens — a charge succeeds, a subscription is created, an invoice is billed. Without this component, you have to write and maintain your own webhook receiver, HMAC signature verification, database schema, and reactive queries.

This component owns all of that. Drop it in, mount the webhook, and your Convex app immediately has:

- **Reactive transaction state** — every transaction, live in Convex, keyed by reference
- **Reactive subscription state** — subscription status, plan, next payment date, live in Convex
- **Checkout** — `initializeTransaction()` generates a Paystack-hosted checkout link
- **Server-side verification** — `verifyTransaction()` confirms a transaction directly with Paystack
- **Subscription management** — `cancelSubscription()` / `enableSubscription()` call Paystack directly and keep local state in sync
- **Webhook idempotency** — duplicate deliveries of the same event are detected and skipped

> **Webhook timing:** After a payment or subscription action occurs in Paystack, there is a short delay — usually a few seconds — before the webhook arrives and your Convex data updates. Once the webhook arrives, Convex's real-time reactivity propagates the change to all subscribers instantly.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Setup](#setup)
- [Usage](#usage)
- [Checkout](#checkout)
- [Subscriptions](#subscriptions)
- [API Reference](#api-reference)
- [Type Reference](#type-reference)
- [Webhook Events](#webhook-events)
- [Database Schema](#database-schema)
- [Customer IDs](#customer-ids)
- [Testing](#testing)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Changelog](#changelog)

## Install

```bash
npm install convex-paystack
```

**Requirements:** Convex v1.33.1 or later, Node.js 18+, a [Paystack](https://paystack.com) account

## Quick Start

Five steps to add Paystack to your Convex app.

### 1. Add the component

In `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import convexPaystack from "convex-paystack/convex.config";

const app = defineApp();
app.use(convexPaystack);

export default app;
```

### 2. Set environment variables

```bash
npx convex env set PAYSTACK_SECRET_KEY sk_live_xxxxxxxxxxxx
```

### 3. Mount the webhook handler

In `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { Paystack } from "convex-paystack";

const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

const http = httpRouter();

http.route({
  path: "/webhooks/paystack",
  method: "POST",
  handler: paystack.webhookHandler,
});

export default http;
```

### 4. Register the webhook in Paystack

1. In Paystack Dashboard → **Settings → API Keys & Webhooks**
2. Set the webhook URL: `https://your-deployment.convex.site/webhooks/paystack`
3. Save. Paystack sends every event to this URL — the handler ignores events it doesn't recognize.

Your Convex site URL is in the Convex dashboard under **Settings → URL & Deploy Key** — it ends in `.convex.site`.

### 5. Initialize the client

In `convex/payments.ts`:

```ts
import { components } from "./_generated/api";
import { Paystack } from "convex-paystack";

export const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});
```

Import `paystack` from this file in any Convex function that needs payments.

## Setup

**`convex/payments.ts`** — your central payments module:

```ts
import { components } from "./_generated/api";
import { Paystack } from "convex-paystack";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const paystack = new Paystack(components.convexPaystack, {
  secretKey: process.env.PAYSTACK_SECRET_KEY!,
});

export const checkout = action({
  args: { email: v.string(), amount: v.number() },
  handler: async (ctx, args) => paystack.initializeTransaction(ctx, args),
});
```

**`convex/http.ts`** — webhook entry point (shown in [Quick Start](#quick-start)).

## Usage

### Start a checkout

```ts
export const checkout = action({
  args: { email: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    return await paystack.initializeTransaction(ctx, {
      email: args.email,
      amount: args.amount, // subunit — kobo for NGN, pesewas for GHS, cents for USD
      callbackUrl: "https://yourapp.com/payment/callback",
    });
  },
});
// Returns: { authorizationUrl, accessCode, reference }
// Redirect the customer to authorizationUrl.
```

### Verify a transaction

```ts
export const confirmPayment = action({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await paystack.verifyTransaction(ctx, args);
  },
});
// Returns: { status, reference, amount, currency, channel, paidAt, customerEmail, ... }
```

### Read a transaction reactively

```ts
export const getTransaction = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    return await paystack.getTransaction(ctx, args);
  },
});
// Returns: Transaction | null
```

### List a customer's transactions

```ts
export const getHistory = query({
  args: { customerEmail: v.string() },
  handler: async (ctx, args) => {
    return await paystack.listTransactions(ctx, {
      customerEmail: args.customerEmail,
      limit: 20,
    });
  },
});
// Returns: Transaction[] ordered newest first
```

## Checkout

`initializeTransaction()` calls Paystack's [Initialize Transaction](https://paystack.com/docs/payments/accept-payments/) endpoint, records a `pending` transaction locally, and returns the hosted checkout URL. Send the customer to `authorizationUrl`; Paystack redirects them back to `callbackUrl` after payment.

Call `verifyTransaction()` from your callback route (or rely on the `charge.success` webhook) to confirm the final status — never trust the client-side redirect alone.

## Subscriptions

Subscriptions are created on Paystack's side (via the [Subscriptions API](https://paystack.com/docs/payments/subscriptions/) or Dashboard) against a plan and a customer with a prior transaction. This component mirrors subscription state reactively as webhooks arrive, and exposes cancel/enable:

```ts
export const cancelPlan = action({
  args: { code: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    await paystack.cancelSubscription(ctx, args);
    return null;
  },
});
```

`code` and `token` are the subscription's `subscription_code` and `email_token`, both delivered on the `subscription.create` webhook and available via `getSubscription()`.

## API Reference

| Method | Kind | Description |
| --- | --- | --- |
| `initializeTransaction(ctx, args)` | action | Starts a Paystack checkout, returns the hosted payment link |
| `verifyTransaction(ctx, args)` | action | Confirms a transaction's final status with Paystack |
| `cancelSubscription(ctx, args)` | action | Disables a subscription on Paystack and locally |
| `enableSubscription(ctx, args)` | action | Re-enables a non-renewing subscription |
| `getTransaction(ctx, args)` | query | Fetch one transaction by reference |
| `listTransactions(ctx, args)` | query | List a customer's transactions, newest first |
| `getSubscription(ctx, args)` | query | Fetch one subscription by subscription code |
| `listSubscriptions(ctx, args)` | query | List a customer's subscriptions |
| `hasActiveSubscription(ctx, args)` | query | `true` if the customer has an active or non-renewing subscription |

## Type Reference

```ts
type InitializeTransactionArgs = {
  email: string;
  amount: number;
  currency?: string;
  callbackUrl?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

type Transaction = {
  reference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "abandoned";
  channel?: string;
  gatewayResponse?: string;
  authorizationCode?: string;
  paidAt?: number;
  metadata?: string;
};

type Subscription = {
  subscriptionCode: string;
  emailToken?: string;
  customerEmail: string;
  customerCode?: string;
  planCode: string;
  status: "active" | "non-renewing" | "attention" | "completed" | "cancelled";
  amount?: number;
  nextPaymentDate?: number;
};
```

## Webhook Events

The webhook handler verifies the `x-paystack-signature` header (hex-encoded HMAC-SHA512 of the raw request body, keyed with your secret key) before processing anything, and de-duplicates by event id so retried deliveries are safe. It currently acts on:

| Event | Effect |
| --- | --- |
| `charge.success` | Upserts the transaction as `success` |
| `subscription.create` | Upserts the subscription record |
| `subscription.disable` | Marks the subscription `cancelled` |
| `subscription.not_renew` | Marks the subscription `non-renewing` |
| `invoice.update` | Marks the subscription `active` or `attention` depending on invoice status |

All other event types are accepted (HTTP 200) but ignored, so you can register every event on one endpoint without errors.

## Database Schema

```ts
transactions: {
  reference, customerEmail, amount, currency, status,
  channel?, gatewayResponse?, authorizationCode?, paidAt?, metadata?,
  createdAt, updatedAt,
}

subscriptions: {
  subscriptionCode, emailToken?, customerEmail, customerCode?, planCode, status,
  amount?, nextPaymentDate?, createdAt, updatedAt,
}

webhookEvents: {
  eventId, eventType, reference?, payload, receivedAt,
}
```

## Customer IDs

This component keys everything on `customerEmail` — the email Paystack has on file for the transaction or subscription. If your app identifies customers a different way (e.g. an internal user id), keep a mapping from your own id to the email you pass into this component.

## Testing

```bash
npm run test
```

Component logic is tested with [`convex-test`](https://www.npmjs.com/package/convex-test) in `src/component/lib.test.ts`. Import `convex-paystack/test` in your own app to register this component's schema against your test instance.

## Limitations

- Amounts are in Paystack's subunit for the currency (kobo, pesewas, cents) — this component does not convert them.
- Only the webhook events listed above update local state; other events are received but not persisted beyond the raw idempotency record.
- `cancelSubscription` / `enableSubscription` require the subscription's `code` and `token`, both only available after a `subscription.create` webhook has been received.

## Troubleshooting

**Webhook returns 401** — the `x-paystack-signature` header didn't match. Confirm `PAYSTACK_SECRET_KEY` is your live/test secret key (not the public key) and matches the key used in the Paystack Dashboard for this webhook endpoint.

**Transaction stays `pending`** — `initializeTransaction` only records `pending`; it becomes `success`/`failed` once the `charge.success` webhook arrives or you call `verifyTransaction`.

**Subscription never appears** — subscriptions are created on Paystack, not by this component. Confirm the `subscription.create` webhook is registered and reaching your endpoint.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
