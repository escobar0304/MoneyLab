import { SandboxedEmbed } from './SandboxedEmbed';

/**
 * One of TradingView's free embeddable widgets, framed rather than injected.
 *
 * These used to append a `<script src="s3.tradingview.com/…">` into this page,
 * which put third-party code in our own origin with read access to the ledger
 * in localStorage. `SandboxedEmbed` runs each one in a frame with an opaque
 * origin instead; what is left in this file is configuration.
 */
function Widget({
  file,
  config,
  height = 400,
  title,
}: {
  file: string;
  config: Record<string, unknown>;
  height?: number;
  title: string;
}) {
  return <SandboxedEmbed widget={file} config={config} height={height} title={title} />;
}


/** Buy/sell/neutral rating for one symbol, rolled up from its own indicators —
 * a second, independent read alongside the raw chart. */
export function TechnicalAnalysisWidget({ symbol, height = 425 }: { symbol: string; height?: number }) {
  return (
    <Widget
      file="technical-analysis"
      title={`${symbol} technical rating`}
      height={height}
      config={{
        interval: '1m',
        width: '100%',
        height,
        // `isTransparent: true` doesn't blend with the app the way it does on
        // the chart embed — this widget's inner panel stays white regardless
        // of colorTheme once it's set, so it paints its own dark background
        // instead (a visible edge against the Card, but actually dark).
        isTransparent: false,
        symbol,
        showIntervalTabs: true,
        displayMode: 'single',
        locale: 'en',
        colorTheme: 'dark',
      }}
    />
  );
}

/** The fundamentals strip — price, day range, market cap — for whichever
 * symbol is selected, so the number line isn't only ever a candle shape. */
export function SymbolInfoWidget({ symbol }: { symbol: string }) {
  return (
    <Widget
      file="symbol-info"
      title={`${symbol} summary`}
      height={170}
      config={{
        symbol,
        width: '100%',
        locale: 'en',
        colorTheme: 'dark',
        isTransparent: false,
      }}
    />
  );
}

/** Recent headlines for the selected symbol. */
export function SymbolNewsWidget({ symbol, height = 425 }: { symbol: string; height?: number }) {
  return (
    <Widget
      file="timeline"
      title={`${symbol} news`}
      height={height}
      config={{
        feedMode: 'symbol',
        symbol,
        colorTheme: 'dark',
        isTransparent: false,
        displayMode: 'regular',
        width: '100%',
        height,
        locale: 'en',
      }}
    />
  );
}

/** Today's top gainers, losers and most active — the "what's moving" list a
 * personal watchlist can't answer, because it only ever shows what you already
 * thought to add. */
export function HotlistsWidget({ height = 460 }: { height?: number }) {
  return (
    <Widget
      file="hotlists"
      title="Trending today"
      height={height}
      config={{
        colorTheme: 'dark',
        dateRange: '12M',
        exchange: 'US',
        showChart: true,
        showSymbolLogo: true,
        showFloatingTooltip: false,
        isTransparent: false,
        width: '100%',
        height,
        locale: 'en',
      }}
    />
  );
}

/** Indices, crypto and forex at a glance — deliberately not scoped to the
 * watchlist, so there's somewhere to look before you know what you're looking
 * for. */
export function MarketOverviewWidget({ height = 420 }: { height?: number }) {
  return (
    <Widget
      file="market-overview"
      title="Market overview"
      height={height}
      config={{
        colorTheme: 'dark',
        dateRange: '12M',
        showChart: true,
        locale: 'en',
        width: '100%',
        height,
        isTransparent: false,
        showSymbolLogo: true,
        showFloatingTooltip: false,
        tabs: [
          {
            title: 'Indices',
            originalTitle: 'Indices',
            symbols: [
              { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
              { s: 'FOREXCOM:NSXUSD', d: 'US 100' },
              { s: 'FOREXCOM:DJI', d: 'Dow 30' },
              { s: 'INDEX:DEU40', d: 'DAX' },
              { s: 'FOREXCOM:UKXGBP', d: 'UK 100' },
            ],
          },
          {
            title: 'Crypto',
            originalTitle: 'Crypto',
            symbols: [
              { s: 'BITSTAMP:BTCUSD', d: 'Bitcoin' },
              { s: 'BITSTAMP:ETHUSD', d: 'Ethereum' },
              { s: 'COINBASE:SOLUSD', d: 'Solana' },
            ],
          },
          {
            title: 'Forex',
            originalTitle: 'Forex',
            symbols: [
              { s: 'FX:EURUSD', d: 'EUR/USD' },
              { s: 'FX:GBPUSD', d: 'GBP/USD' },
              { s: 'FX:USDJPY', d: 'USD/JPY' },
            ],
          },
        ],
      }}
    />
  );
}
