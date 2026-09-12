import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Button, Spinner, StatusIcon } from "./ui";
import { formatAmount } from "../lib/currency";
import { readPendingAttempt, clearPendingAttempt, type PendingAttempt } from "../lib/pendingAttempt";
import { useLog } from "../lib/logStore";

type VerifyResult = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  gatewayResponse?: string;
};

export function Result({
  reference,
  onRetry,
  onDone,
}: {
  reference: string;
  onRetry: (attempt: PendingAttempt | null) => void;
  onDone: () => void;
}) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = readPendingAttempt();

  const verifyTransaction = useAction(api.example.verifyTransaction);
  const syncSubscriptions = useAction(api.example.syncSubscriptions);
  const { log } = useLog();

  useEffect(() => {
    let cancelled = false;
    log(`Verifying ref=${reference} with Paystack…`);
    verifyTransaction({ reference })
      .then(async (r) => {
        if (cancelled) return;
        setResult(r);
        log(
          r.status === "success"
            ? `Verified — payment succeeded (${formatAmount(r.amount, r.currency)}).`
            : `Verified — payment ${r.status}.`,
          r.status === "success" ? "success" : "error",
        );

        // A subscription checkout doesn't show up locally until the
        // subscription.create webhook arrives, which requires that
        // webhook URL to be registered in the Paystack Dashboard. Sync
        // directly from Paystack too, so the demo works immediately
        // even before that's set up.
        if (r.status === "success" && pending?.kind === "subscription") {
          try {
            const synced = await syncSubscriptions({ email: pending.email });
            if (!cancelled) {
              log(
                synced > 0
                  ? `Synced ${synced} subscription${synced === 1 ? "" : "s"} from Paystack.`
                  : "No subscription found yet on Paystack for this email — it may still be processing.",
                synced > 0 ? "success" : "info",
              );
            }
          } catch (err) {
            if (!cancelled) {
              log(
                `Couldn't sync subscription state: ${err instanceof Error ? err.message : "unknown error"}`,
                "error",
              );
            }
          }
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Verification failed";
        if (!cancelled) {
          setError(message);
          log(`Verification failed: ${message}`, "error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  if (error) {
    return (
      <Card className="flow-card result-card result-card--failed">
        <StatusIcon status="failed" />
        <h2>Couldn't verify this payment</h2>
        <p>{error}</p>
        <Button onClick={onDone}>Back to home</Button>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="flow-card result-card">
        <Spinner size={32} />
        <h2>Verifying your payment…</h2>
        <p>Confirming <code>{reference}</code> with Paystack.</p>
      </Card>
    );
  }

  const succeeded = result.status === "success";

  return (
    <Card className={`flow-card result-card ${succeeded ? "result-card--success" : "result-card--failed"}`}>
      <StatusIcon status={succeeded ? "success" : "failed"} />
      <h2>{succeeded ? "Payment successful" : "Payment did not complete"}</h2>
      <p className="result-card__amount">{formatAmount(result.amount, result.currency)}</p>
      {pending && <p className="result-card__label">{pending.label}</p>}

      <dl className="result-card__meta">
        <div>
          <dt>Reference</dt>
          <dd><code>{result.reference}</code></dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{result.status}</dd>
        </div>
        {result.channel && (
          <div>
            <dt>Channel</dt>
            <dd>{result.channel}</dd>
          </div>
        )}
        {result.gatewayResponse && (
          <div>
            <dt>Gateway response</dt>
            <dd>{result.gatewayResponse}</dd>
          </div>
        )}
      </dl>

      <div className="result-card__actions">
        {!succeeded && (
          <Button
            onClick={() => {
              const attempt = pending;
              clearPendingAttempt();
              onRetry(attempt);
            }}
          >
            Try again
          </Button>
        )}
        <Button variant="secondary" onClick={onDone}>
          {succeeded ? "Done" : "Back to home"}
        </Button>
      </div>
    </Card>
  );
}
