// Stripe's true zero-decimal currencies. TWD is NOT one of them (it is 2-decimal in Stripe).
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/**
 * Whole-unit price → Stripe's smallest unit. Deliberately NOT driven by
 * platform_settings.currency_minor_units, which is a display setting.
 */
export function stripeUnitAmount(price: number, currency: string): number {
  return Math.round(price * (ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100));
}
