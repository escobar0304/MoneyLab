/** Everything in the ledger is stored in this currency. */
export const BASE_CURRENCY = 'EUR';

/** Offered in the picker. Any ECB-quoted code works if typed. */
export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'BRL', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'PLN'] as const;

const ENDPOINT = 'https://api.frankfurter.dev/v1';

export interface RateLookup {
  rate: number;
  /** The date the rate actually applies to. Frankfurter returns the previous
   * working day for weekends and holidays, so this is not always the date asked
   * for — and the difference is worth showing rather than hiding. */
  date: string;
  source: 'network' | 'cache';
}

/** `2026-08-09:USD` — the cache key for one currency on one day. */
export function rateKey(date: string, currency: string): string {
  return `${date.slice(0, 10)}:${currency.toUpperCase()}`;
}

/**
 * How many euros one unit of `currency` was worth on `date`.
 *
 * Rates are looked up for the date of the expense, never for today. Converting
 * an old expense at today's rate would silently rewrite the value of past
 * months every time the market moved, and a ledger whose history changes under
 * you is worse than no conversion at all.
 *
 * Frankfurter publishes ECB reference rates, needs no key, and is only consulted
 * for currencies the ledger actually uses. Failure is expected and handled by
 * the caller: the entry form falls back to asking for the rate.
 */
export async function fetchRate(currency: string, date: string, signal?: AbortSignal): Promise<RateLookup> {
  const code = currency.toUpperCase();
  if (code === BASE_CURRENCY) return { rate: 1, date: date.slice(0, 10), source: 'cache' };

  const day = date.slice(0, 10);
  const res = await fetch(`${ENDPOINT}/${day}?base=${code}&symbols=${BASE_CURRENCY}`, { signal });
  if (!res.ok) throw new Error(`Rate lookup failed (${res.status})`);

  const body = (await res.json()) as { date?: string; rates?: Record<string, number> };
  const rate = body.rates?.[BASE_CURRENCY];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No ${code}->${BASE_CURRENCY} rate for ${day}`);
  }
  return { rate, date: body.date ?? day, source: 'network' };
}

/** Converts to the base currency and rounds to cents, so stored amounts are
 * always exact money rather than a float that drifts when summed. */
export function toBase(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function formatForeign(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    // Intl throws on codes it doesn't know; a typed-in code shouldn't crash the form.
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
