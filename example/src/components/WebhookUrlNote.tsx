import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * "Why is my subscription/transaction not updating?" is almost always
 * "the webhook URL for this deployment was never registered in the
 * Paystack Dashboard" — especially after creating a fresh Convex project.
 * Surfacing the exact URL, with a copy button, turns that into a
 * two-second fix instead of a debugging session.
 */
export function WebhookUrlNote() {
  const url = useQuery(api.example.getWebhookUrl, {});
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked (permissions, insecure context) —
      // the URL is still shown in plain text, so nothing else to do.
    }
  }

  return (
    <div className="webhook-note">
      <span className="webhook-note__label">Webhook URL for this deployment</span>
      <div className="webhook-note__row">
        <code>{url ?? "connecting…"}</code>
        {url && (
          <button className="link-button" onClick={copy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
      <p>
        Register this exact URL in Paystack Dashboard → Settings → API Keys &amp; Webhooks
        (test mode). Without it, subscription and payment status updates never reach Convex —
        transactions still work because <code>verifyTransaction</code> calls Paystack directly,
        but subscriptions rely entirely on this webhook.
      </p>
    </div>
  );
}
