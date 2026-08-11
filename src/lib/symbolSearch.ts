/**
 * Symbol lookup for the picker.
 *
 * TradingView's own search endpoint refuses any request whose `Referer` is not
 * tradingview.com — and `Referer` and `Origin` are forbidden headers that page
 * JavaScript cannot set. So it cannot be called from the browser, full stop.
 *
 * Two tiers, therefore. A bundled catalogue of ~60 instruments answers instantly
 * and works offline, and when the app is served by its own nginx (or the Vite
 * dev server) a small proxy forwards to the real search and the whole TradingView
 * universe becomes reachable. Static hosting with no proxy degrades to the
 * catalogue plus whatever the user types by hand, which still works.
 */

export interface SymbolHit {
  /** The widget symbol, `EXCHANGE:TICKER`. */
  id: string;
  label: string;
  description: string;
  /** Where it came from, so the UI can say when a result is only a suggestion. */
  source: 'catalogue' | 'tradingview';
  group?: string;
  type?: string;
}

interface CatalogueEntry {
  id: string;
  label: string;
  description: string;
  group: string;
}

/**
 * Instruments verified against TradingView's search index rather than written
 * from memory — every prefix here is the one their widget actually accepts.
 * Weighted towards what a Portuguese investor holds: UCITS accumulating ETFs,
 * the Lisbon listings, and the European majors.
 */
export const CATALOGUE: CatalogueEntry[] = [
  { id: 'AMEX:SPY', label: 'SPY', description: 'SPDR S&P 500 ETF TRUST', group: 'ETF' },
  { id: 'AMEX:VOO', label: 'VOO', description: 'Vanguard S&P 500 ETF', group: 'ETF' },
  { id: 'AMEX:VTI', label: 'VTI', description: 'Vanguard Morningstar Total Stock Market ETF', group: 'ETF' },
  { id: 'EURONEXT:AGGH', label: 'AGGH', description: 'iShares Core Global Aggregate Bond UCITS ETF Accum Hedged EUR', group: 'ETF' },
  { id: 'EURONEXT:IWDA', label: 'IWDA', description: 'iShares Core MSCI World UCITS ETF', group: 'ETF' },
  { id: 'EURONEXT:VWRL', label: 'VWRL', description: 'Vanguard FTSE All-World UCITS ETF', group: 'ETF' },
  { id: 'LSE:CSPX', label: 'CSPX', description: 'iShares Core S&P 500 UCITS ETF', group: 'ETF' },
  { id: 'LSE:EIMI', label: 'EIMI', description: 'iShares Core MSCI EM IMI UCITS ETF', group: 'ETF' },
  { id: 'LSE:SWDA', label: 'SWDA', description: 'iShares Core MSCI World UCITS ETF', group: 'ETF' },
  { id: 'LSE:VUSA', label: 'VUSA', description: 'Vanguard S&P 500 UCITS ETF', group: 'ETF' },
  { id: 'NASDAQ:QQQ', label: 'QQQ', description: 'Invesco QQQ Trust, Series 1', group: 'ETF' },
  { id: 'XETR:EUNL', label: 'EUNL', description: 'iShares Core MSCI World UCITS ETF', group: 'ETF' },
  { id: 'XETR:IS3N', label: 'IS3N', description: 'iShares Core MSCI EM IMI UCITS ETF', group: 'ETF' },
  { id: 'XETR:QDVE', label: 'QDVE', description: 'iShares S&P 500 Information Technology Sector UCITS ETF', group: 'ETF' },
  { id: 'XETR:SXR8', label: 'SXR8', description: 'iShares Core S&P 500 UCITS ETF', group: 'ETF' },
  { id: 'XETR:VUAA', label: 'VUAA', description: 'Vanguard S&P 500 UCITS ETF', group: 'ETF' },
  { id: 'XETR:VWCE', label: 'VWCE', description: 'Vanguard FTSE All-World UCITS ETF Accum USD', group: 'ETF' },
  { id: 'EURONEXT:ALTR', label: 'ALTR', description: 'Altri, SGPS, S.A.', group: 'Portugal' },
  { id: 'EURONEXT:BCP', label: 'BCP', description: 'Banco Comercial Portugues S.A.', group: 'Portugal' },
  { id: 'EURONEXT:CTT', label: 'CTT', description: 'CTT - Correios de Portugal SA', group: 'Portugal' },
  { id: 'EURONEXT:EDP', label: 'EDP', description: 'EDP S.A.', group: 'Portugal' },
  { id: 'EURONEXT:EGL', label: 'EGL', description: 'Mota-Engil SGPS SA', group: 'Portugal' },
  { id: 'EURONEXT:GALP', label: 'GALP', description: 'Galp Energia, SGPS S.A. Class B', group: 'Portugal' },
  { id: 'EURONEXT:JMT', label: 'JMT', description: 'Jeronimo Martins, SGPS S.A.', group: 'Portugal' },
  { id: 'EURONEXT:NOS', label: 'NOS', description: 'NOS SGPS SA', group: 'Portugal' },
  { id: 'EURONEXT:NVG', label: 'NVG', description: 'Navigator Company SA', group: 'Portugal' },
  { id: 'EURONEXT:SEM', label: 'SEM', description: 'Semapa Sociedade de Investimento e Gestao SGPS SA', group: 'Portugal' },
  { id: 'BME:ITX', label: 'ITX', description: 'Industria de Diseno Textil, S.A.', group: 'Europe' },
  { id: 'BME:SAN', label: 'SAN', description: 'Banco Santander, S.A.', group: 'Europe' },
  { id: 'EURONEXT:ASML', label: 'ASML', description: 'ASML Holding NV', group: 'Europe' },
  { id: 'EURONEXT:MC', label: 'MC', description: 'LVMH Moet Hennessy Louis Vuitton SE', group: 'Europe' },
  { id: 'SIX:NESN', label: 'NESN', description: 'Nestle S.A.', group: 'Europe' },
  { id: 'XETR:SAP', label: 'SAP', description: 'SAP SE', group: 'Europe' },
  { id: 'XETR:SIE', label: 'SIE', description: 'Siemens AG', group: 'Europe' },
  { id: 'NASDAQ:AAPL', label: 'AAPL', description: 'Apple Inc.', group: 'Stocks' },
  { id: 'NASDAQ:AMZN', label: 'AMZN', description: 'Amazon.com, Inc.', group: 'Stocks' },
  { id: 'NASDAQ:GOOGL', label: 'GOOGL', description: 'Alphabet Inc.', group: 'Stocks' },
  { id: 'NASDAQ:META', label: 'META', description: 'Meta Platforms, Inc.', group: 'Stocks' },
  { id: 'NASDAQ:MSFT', label: 'MSFT', description: 'Microsoft Corporation', group: 'Stocks' },
  { id: 'NASDAQ:NVDA', label: 'NVDA', description: 'NVIDIA Corporation', group: 'Stocks' },
  { id: 'NASDAQ:TSLA', label: 'TSLA', description: 'Tesla, Inc.', group: 'Stocks' },
  { id: 'NYSE:BRK.B', label: 'BRK.B', description: 'Berkshire Hathaway Inc. New', group: 'Stocks' },
  { id: 'NYSE:JPM', label: 'JPM', description: 'JP Morgan Chase & Co.', group: 'Stocks' },
  { id: 'NYSE:KO', label: 'KO', description: 'Coca-Cola Company (The)', group: 'Stocks' },
  { id: 'NYSE:V', label: 'V', description: 'Visa Inc.', group: 'Stocks' },
  { id: 'EURONEXT:PSI20', label: 'PSI20', description: 'PSI Index', group: 'Index' },
  { id: 'NASDAQ:NDX', label: 'NDX', description: 'NASDAQ 100 Index', group: 'Index' },
  { id: 'SP:SPX', label: 'SPX', description: 'S&P 500', group: 'Index' },
  { id: 'TVC:CAC40', label: 'CAC40', description: 'CAC 40', group: 'Index' },
  { id: 'TVC:DJI', label: 'DJI', description: 'Dow Jones Industrial Average Index', group: 'Index' },
  { id: 'TVC:SX5E', label: 'SX5E', description: 'STOXX 50', group: 'Index' },
  { id: 'TVC:UKX', label: 'UKX', description: 'UK 100 INDEX', group: 'Index' },
  { id: 'XETR:DAX', label: 'DAX', description: 'DAX Index', group: 'Index' },
  { id: 'BINANCE:BTCEUR', label: 'BTCEUR', description: 'Bitcoin / Euro', group: 'Crypto' },
  { id: 'BINANCE:BTCUSD', label: 'BTCUSD', description: 'Bitcoin / USD', group: 'Crypto' },
  { id: 'BINANCE:ETHEUR', label: 'ETHEUR', description: 'Ethereum / Euro', group: 'Crypto' },
  { id: 'BINANCE:SOLEUR', label: 'SOLEUR', description: 'SOL / Euro', group: 'Crypto' },
  { id: 'OANDA:XAUUSD', label: 'XAUUSD', description: 'Gold', group: 'Commodities' },
  { id: 'FX:EURUSD', label: 'EURUSD', description: 'Euro vs. US Dollar', group: 'Forex' },
];

/** Ticker prefix beats a description match, so typing "SP" offers SPY and SPX
 * before "iShares Core S&P 500". */
function score(entry: CatalogueEntry, query: string): number {
  const q = query.toLowerCase();
  const label = entry.label.toLowerCase();
  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (entry.id.toLowerCase().includes(q)) return 2;
  if (entry.description.toLowerCase().includes(q)) return 3;
  return Number.POSITIVE_INFINITY;
}

export function searchCatalogue(query: string, limit = 12): SymbolHit[] {
  const q = query.trim();
  if (!q) {
    return CATALOGUE.slice(0, limit).map((e) => ({ ...e, source: 'catalogue' as const }));
  }
  return CATALOGUE.map((entry) => ({ entry, rank: score(entry, q) }))
    .filter((r) => Number.isFinite(r.rank))
    .sort((a, b) => a.rank - b.rank || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
    .map((r) => ({ ...r.entry, source: 'catalogue' as const }));
}

interface RemoteSymbol {
  symbol?: string;
  description?: string;
  type?: string;
  exchange?: string;
  prefix?: string;
  source_id?: string;
}

/** Search results are HTML-highlighted by the API (`<em>VWCE</em>`); tags are
 * stripped rather than rendered, so nothing from a third party is ever inserted
 * into the page as markup. */
function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/** The proxy path, matched by both the Vite dev server and the nginx image. */
export const SEARCH_PATH = '/tv-search';

/**
 * The full TradingView index, via the local proxy.
 *
 * Throws on any non-OK response so the caller can fall back to the catalogue —
 * static hosting simply has no such route, and that is a supported way to run
 * the app, not an error worth showing.
 */
export async function searchRemote(query: string, signal?: AbortSignal, limit = 12): Promise<SymbolHit[]> {
  const response = await fetch(`${SEARCH_PATH}?text=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(`Symbol search unavailable (${response.status})`);

  const body: unknown = await response.json();
  const rows: RemoteSymbol[] = Array.isArray(body)
    ? (body as RemoteSymbol[])
    : ((body as { symbols?: RemoteSymbol[] })?.symbols ?? []);

  const hits: SymbolHit[] = [];
  for (const row of rows) {
    const ticker = row.symbol ? stripTags(row.symbol) : '';
    const prefix = row.prefix ?? row.source_id ?? '';
    // Futures contracts and anything without a resolvable prefix cannot be
    // charted from an `EXCHANGE:TICKER` string, so they are dropped rather than
    // offered as options that fail once selected.
    if (!ticker || !prefix) continue;
    hits.push({
      id: `${prefix.toUpperCase()}:${ticker}`,
      label: ticker,
      description: stripTags(row.description ?? ''),
      source: 'tradingview',
      group: row.exchange,
      type: row.type,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
