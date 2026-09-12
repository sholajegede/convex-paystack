import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, Button, ChannelPicker } from "./ui";
import { CURRENCIES, symbolFor, toSubunit, type CurrencyCode } from "../lib/currency";
import { savePendingAttempt } from "../lib/pendingAttempt";
import { useLog } from "../lib/logStore";

type ChannelValue = "card" | "bank_transfer" | "ussd" | "mobile_money" | "qr";

const CHANNEL_OPTIONS: Array<{ value: ChannelValue; label: string }> = [
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "ussd", label: "USSD" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "qr", label: "QR" },
];

export function OneTimePayment({
  email,
  setEmail,
  onError,
}: {
  email: string;
  setEmail: (email: string) => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState(5000);
  const [currency, setCurrency] = useState<CurrencyCode>("NGN");
  const [enabledCurrencies, setEnabledCurrencies] = useState<CurrencyCode[]>(["NGN"]);
  const [channels, setChannels] = useState<ChannelValue[]>(["card", "bank_transfer", "ussd"]);
  const [submitting, setSubmitting] = useState(false);

  const initializeTransaction = useAction(api.example.initializeTransaction);
  const listEnabledCurrencies = useAction(api.example.listEnabledCurrencies);
  const { log } = useLog();

  // Only offer currencies this Paystack account can actually charge —
  // initializeTransaction throws "Currency not supported by merchant"
  // for anything else, which is an account setting, not something a
  // client-side FX conversion could paper over honestly.
  useEffect(() => {
    let cancelled = false;
    listEnabledCurrencies({})
      .then((codes) => {
        if (cancelled) return;
        const known = codes.filter((c): c is CurrencyCode =>
          CURRENCIES.some((currencyOption) => currencyOption.code === c),
        );
        if (known.length > 0) {
          setEnabledCurrencies(known);
          setCurrency((current) => (known.includes(current) ? current : known[0]));
        }
      })
      .catch(() => {
        // Fall back silently to the NGN-only default already in state —
        // this is a nice-to-have filter, not required for checkout to work.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyOptions = CURRENCIES.filter((c) => enabledCurrencies.includes(c.code));

  function toggleChannel(value: string) {
    const next = value as ChannelValue;
    setChannels((prev) => (prev.includes(next) ? prev.filter((c) => c !== next) : [...prev, next]));
  }

  async function pay() {
    if (!email || amount <= 0) return;
    setSubmitting(true);
    log(`Initializing ${symbolFor(currency)}${amount.toLocaleString()} checkout for ${email}…`);
    try {
      const result = await initializeTransaction({
        email,
        amount: toSubunit(amount),
        currency,
        channels: channels.length ? channels : undefined,
        callbackUrl: window.location.origin + window.location.pathname,
      });
      log(`Checkout ready — ref=${result.reference}. Redirecting to Paystack…`, "success");
      savePendingAttempt({
        kind: "one-time",
        email,
        amount,
        currency,
        channels,
        label: `${symbolFor(currency)}${amount.toLocaleString()} one-time payment`,
      });
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setSubmitting(false);
      const raw = err instanceof Error ? err.message : "Failed to start payment";
      const message = raw.includes("Currency not supported")
        ? `${currency} isn't enabled on this Paystack account yet. Enable it in Dashboard → Settings → Preferences, or switch back to NGN.`
        : raw;
      log(`Checkout failed: ${message}`, "error");
      onError(message);
    }
  }

  return (
    <Card className="flow-card">
      <h2>One-time payment</h2>
      <p className="flow-card__lede">
        Enter an amount in major units — the component converts it to Paystack's subunit
        format (kobo, pesewas, cents…) automatically.
      </p>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <div className="field-row">
        <label className="field field--amount">
          <span>Amount</span>
          <div className="amount-input">
            <span className="amount-input__symbol">{symbolFor(currency)}</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
        </label>

        <label className="field field--currency">
          <span>Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
            {currencyOptions.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {currencyOptions.length <= 1 && (
        <p className="field-hint">
          Only {currencyOptions[0]?.code ?? "NGN"} is enabled on this Paystack account —
          enable more in Dashboard → Settings → Preferences to see them here.
        </p>
      )}

      <label className="field">
        <span>Channels to offer at checkout</span>
        <ChannelPicker options={CHANNEL_OPTIONS} selected={channels} onToggle={toggleChannel} />
      </label>

      <Button onClick={pay} disabled={!email || amount <= 0 || submitting}>
        {submitting ? "Starting checkout…" : `Pay ${symbolFor(currency)}${amount.toLocaleString()} with Paystack`}
      </Button>
    </Card>
  );
}
