import { Button } from "./ui";
import type { Screen } from "./Header";

export function Home({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero__dots" aria-hidden="true" />
        <div className="hero__content">
          <span className="eyebrow-pill">Live demo · test mode</span>
          <h1>
            Modern payments and subscriptions,
            <br />
            reactive by default
          </h1>
          <p>
            <strong>convex-paystack</strong> wraps Paystack Checkout, webhooks, and
            subscription billing in one Convex component. Try a real one-time payment or a
            subscription below — every step is visible in the live console (bottom-right).
          </p>
          <div className="hero__actions">
            <Button onClick={() => onNavigate("one-time")}>Try a payment →</Button>
            <button className="hero__secondary" onClick={() => onNavigate("subscription")}>
              Start a subscription
            </button>
          </div>
        </div>
      </section>

      <div className="brand-stripe" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="dev-panel">
        <div className="dev-panel__intro">
          <span className="eyebrow-pill eyebrow-pill--dark">Built for developers</span>
          <h2>Every webhook, reactive.</h2>
          <p>
            No polling, no queue to babysit. Paystack calls your webhook, this component
            verifies the HMAC-SHA512 signature, dedupes by event id, and writes straight to
            Convex — every subscriber updates the instant it lands.
          </p>
          <button className="link-button link-button--light" onClick={() => onNavigate("history")}>
            View the reactive transaction history →
          </button>
        </div>
        <div className="terminal-card">
          <div className="terminal-card__dots">
            <span />
            <span />
            <span />
          </div>
          <pre>{`http.route({
  path: "/webhooks/paystack",
  method: "POST",
  handler: paystack.webhookHandler,
});

// charge.success        → transactions.status = "success"
// subscription.create   → subscriptions upserted
// invoice.update        → active | attention
// invoice.payment_failed→ attention`}</pre>
        </div>
      </section>
    </div>
  );
}
