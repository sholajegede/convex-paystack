export type CurrencyCode = "NGN" | "GHS" | "ZAR" | "USD";

export const CURRENCIES: Array<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: "NGN", symbol: "₦", label: "Naira" },
  { code: "GHS", symbol: "₵", label: "Cedi" },
  { code: "ZAR", symbol: "R", label: "Rand" },
  { code: "USD", symbol: "$", label: "US Dollar" },
];

/** Paystack amounts are always expressed in the smallest currency subunit
 * (kobo for NGN, pesewas for GHS, cents for ZAR/USD) — this helper converts
 * a human-entered major-unit amount (e.g. 5000 Naira) into the subunit
 * integer Paystack's API expects (500000 kobo). */
export function toSubunit(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

/** Inverse of {@link toSubunit} — converts a subunit amount coming back
 * from Paystack (or stored on a transaction/subscription record) into a
 * human-readable major-unit amount. */
export function fromSubunit(subunitAmount: number): number {
  return subunitAmount / 100;
}

export function formatAmount(subunitAmount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(fromSubunit(subunitAmount));
  } catch {
    const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
    return `${symbol}${fromSubunit(subunitAmount).toLocaleString()}`;
  }
}

export function symbolFor(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
}
