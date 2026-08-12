import { BASE_CURRENCY, fetchRate } from './currency';

/**
 * Live-ish prices for held instruments.
 *
 * Goes through the same local proxy as the symbol search, and for the same
 * reason — TradingView's endpoint gates on an `Origin` header that page
 * JavaScript cannot set. One POST covers every holding, so a refresh is a
 * single request no matter how much is owned.
 *
 * "Real time" is not on offer and the UI must not imply it. Most venues report
 * as `delayed_streaming_900` — fifteen minutes behind — while crypto streams
 * live. Each quote carries which it was, so the screen can say so.
 *
 * What leaves the device is the list of ticker symbols. Nothing about
 * quantities, prices paid, or anything else in the ledger is sent.
 */

export const QUOTE_PATH = '/tv-quote';

export interface Quote {
  symbol: string;
  /** Last price, in `currency` — not necessarily the base currency. */
  price: number;
  /** Move since the previous close, as a percentage. */
  changePct: number;
  /** The same move in `currency`. */
  changeAbs: number;
  currency: string;
  /** True when the venue reports on a delay rather than streaming. */
  delayed: boolean;
  fetchedAt: string;
}

/** Price converted into the base currency, and the rate that got it there. */
export interface ConvertedQuote extends Quote {
  basePrice: number;
  baseChangeAbs: number;
  /** Base currency per 1 unit of `currency`. 1 when it already is the base. */
  rate: number;
}

const COLUMNS = ['close', 'change', 'change_abs', 'currency', 'update_mode'] as const;

interface ScanRow {
  s?: string;
  d?: unknown[];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Quotes for the given `EXCHANGE:TICKER` symbols.
 *
 * Symbols the provider does not recognise are simply absent from the result
 * rather than reported as an error — a portfolio with one bad symbol should
 * still price the other nine.
 */
export async function fetchQuotes(symbols: string[], signal?: AbortSignal): Promise<Quote[]> {
  const tickers = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  if (tickers.length === 0) return [];

  const response = await fetch(QUOTE_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: COLUMNS }),
    signal,
  });
  if (!response.ok) throw new Error(`Quotes unavailable (${response.status})`);

  const body = (await response.json()) as { data?: ScanRow[] };
  const fetchedAt = new Date().toISOString();
  const out: Quote[] = [];

  for (const row of body.data ?? []) {
    const [close, change, changeAbs, currency, mode] = row.d ?? [];
    const price = num(close);
    if (!row.s || price === null || price <= 0) continue;

    out.push({
      symbol: row.s,
      price,
      changePct: num(change) ?? 0,
      changeAbs: num(changeAbs) ?? 0,
      currency: typeof currency === 'string' ? currency : BASE_CURRENCY,
      // Anything not explicitly streaming is treated as delayed. Overstating
      // freshness is the one error worth ruling out by default.
      delayed: typeof mode === 'string' ? mode !== 'streaming' : true,
      fetchedAt,
    });
  }

  return out;
}

/** Rates already looked up this session, so ten USD holdings cost one request. */
const rateCache = new Map<string, number>();

/**
 * Converts quotes into the base currency.
 *
 * A holding cross-listed in dollars is quoted in dollars, and adding that
 * figure straight into a euro portfolio silently inflates it by whatever the
 * rate happens to be. Quotes whose rate cannot be found are dropped rather than
 * counted at 1:1 — a missing rate is unknown, not parity.
 */
export async function convertQuotes(quotes: Quote[], signal?: AbortSignal): Promise<ConvertedQuote[]> {
  const today = new Date().toISOString().slice(0, 10);
  const out: ConvertedQuote[] = [];

  for (const quote of quotes) {
    if (quote.currency === BASE_CURRENCY) {
      out.push({ ...quote, basePrice: quote.price, baseChangeAbs: quote.changeAbs, rate: 1 });
      continue;
    }

    let rate = rateCache.get(quote.currency);
    if (rate === undefined) {
      try {
        rate = (await fetchRate(quote.currency, today, signal)).rate;
        rateCache.set(quote.currency, rate);
      } catch {
        continue; // unknown rate: leave the holding on its recorded price
      }
    }

    out.push({
      ...quote,
      rate,
      basePrice: Math.round(quote.price * rate * 100) / 100,
      baseChangeAbs: Math.round(quote.changeAbs * rate * 100) / 100,
    });
  }

  return out;
}

/** Convenience for the hook: fetch and convert in one call. */
export async function fetchConvertedQuotes(symbols: string[], signal?: AbortSignal): Promise<ConvertedQuote[]> {
  return convertQuotes(await fetchQuotes(symbols, signal), signal);
}
