export type PendingAttempt = {
  kind: "one-time" | "subscription";
  email: string;
  label: string;
  amount?: number;
  currency?: string;
  channels?: string[];
  planCode?: string;
};

const KEY = "convex-paystack-demo:pending-attempt";

/** Paystack Checkout is a full-page redirect, so React state does not
 * survive the round trip — this persists just enough context in
 * localStorage to show a meaningful result screen and to prefill a retry. */
export function savePendingAttempt(attempt: PendingAttempt) {
  try {
    localStorage.setItem(KEY, JSON.stringify(attempt));
  } catch {
    // localStorage can be unavailable (private browsing, blocked storage) —
    // the demo still works, it just won't have retry context.
  }
}

export function readPendingAttempt(): PendingAttempt | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingAttempt) : null;
  } catch {
    return null;
  }
}

export function clearPendingAttempt() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
