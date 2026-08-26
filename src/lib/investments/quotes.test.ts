import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchQuotes, convertQuotes, QUOTE_PATH, type Quote } from './quotes';

/** One row of TradingView's scanner response: `s` is the symbol, `d` the columns
 * in the order requested — close, change, change_abs, currency, update_mode. */
const row = (s: string, d: unknown[]) => ({ s, d });

function mockScan(rows: unknown[], ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ data: rows }),
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchQuotes', () => {
  it('asks for every held symbol in one request', async () => {
    const fetchMock = mockScan([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchQuotes(['XETR:VWCE', 'NASDAQ:AAPL']);

    // One POST for the whole portfolio, not one per holding.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(QUOTE_PATH);
    expect(JSON.parse(init.body).symbols.tickers).toEqual(['XETR:VWCE', 'NASDAQ:AAPL']);
  });

  it('upper-cases and de-duplicates the symbols it asks for', async () => {
    const fetchMock = mockScan([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchQuotes(['xetr:vwce', 'XETR:VWCE', ' NASDAQ:AAPL ']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).symbols.tickers).toEqual(['XETR:VWCE', 'NASDAQ:AAPL']);
  });

  it('does not call out at all with nothing held', async () => {
    const fetchMock = mockScan([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await fetchQuotes([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads price, move and currency off the row', async () => {
    globalThis.fetch = mockScan([row('XETR:VWCE', [168.86, 0.22, 0.38, 'EUR', 'delayed_streaming_900'])]) as unknown as typeof fetch;

    const [quote] = await fetchQuotes(['XETR:VWCE']);
    expect(quote).toMatchObject({ symbol: 'XETR:VWCE', price: 168.86, changePct: 0.22, changeAbs: 0.38, currency: 'EUR' });
  });

  it('treats anything not explicitly streaming as delayed', async () => {
    // Overstating freshness is the one error worth ruling out by default.
    globalThis.fetch = mockScan([
      row('A:A', [10, 0, 0, 'EUR', 'delayed_streaming_900']),
      row('B:B', [10, 0, 0, 'EUR', 'streaming']),
      row('C:C', [10, 0, 0, 'EUR', null]),
    ]) as unknown as typeof fetch;

    const quotes = await fetchQuotes(['A:A', 'B:B', 'C:C']);
    expect(quotes.map((q) => q.delayed)).toEqual([true, false, true]);
  });

  it('skips rows with no usable price rather than failing the batch', async () => {
    // One bad symbol must not stop the other nine from being priced.
    globalThis.fetch = mockScan([
      row('GOOD:X', [10, 0, 0, 'EUR', 'streaming']),
      row('BAD:X', [null, null, null, null, null]),
      row('ZERO:X', [0, 0, 0, 'EUR', 'streaming']),
    ]) as unknown as typeof fetch;

    expect((await fetchQuotes(['GOOD:X', 'BAD:X', 'ZERO:X'])).map((q) => q.symbol)).toEqual(['GOOD:X']);
  });

  it('throws when the proxy is missing, so the caller can fall back', async () => {
    globalThis.fetch = mockScan([], false, 404) as unknown as typeof fetch;
    await expect(fetchQuotes(['A:A'])).rejects.toThrow(/404/);
  });
});

const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: 'X:Y',
  price: 100,
  changePct: 1,
  changeAbs: 2,
  currency: 'EUR',
  delayed: true,
  fetchedAt: '2026-08-12T10:00:00.000Z',
  ...over,
});

describe('convertQuotes', () => {
  beforeEach(() => {
    // Frankfurter, as currency.ts calls it: 1 USD = 0.9 EUR.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ date: '2026-08-12', rates: { EUR: 0.9 } }),
    }) as unknown as typeof fetch;
  });

  it('passes base-currency quotes straight through at a rate of 1', async () => {
    const [converted] = await convertQuotes([quote({ currency: 'EUR', price: 100, changeAbs: 2 })]);
    expect(converted).toMatchObject({ rate: 1, basePrice: 100, baseChangeAbs: 2 });
  });

  it('converts a quote priced in another currency', async () => {
    // A holding cross-listed in dollars is quoted in dollars; adding that figure
    // straight into a euro portfolio silently inflates it.
    const [converted] = await convertQuotes([quote({ currency: 'USD', price: 100, changeAbs: 10 })]);
    expect(converted.rate).toBe(0.9);
    expect(converted.basePrice).toBe(90);
    expect(converted.baseChangeAbs).toBe(9);
  });

  it('looks a currency up once however many holdings use it', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await convertQuotes([
      quote({ symbol: 'A:A', currency: 'USD' }),
      quote({ symbol: 'B:B', currency: 'USD' }),
      quote({ symbol: 'C:C', currency: 'USD' }),
    ]);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('drops a quote whose rate cannot be found, rather than counting it at parity', async () => {
    // A missing rate is unknown, not 1:1 — the holding keeps its recorded price.
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await convertQuotes([quote({ symbol: 'ODD:X', currency: 'ZZZ' })])).toEqual([]);
  });
});
