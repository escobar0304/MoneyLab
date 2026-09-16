import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '../ui/primitives';
import { ChartSkeleton } from '../ui/Skeleton';

const BASE = 'https://s3.tradingview.com/external-embedding/embed-widget-';

/**
 * Mounts one of TradingView's free embeddable widgets.
 *
 * Same mechanics as `TradingViewChart`: a throwaway inner node the script owns
 * outright, torn down and rebuilt on every config change rather than patched,
 * because none of these widgets expose an update API once constructed.
 *
 * Mounting is deferred until the widget is nearly on screen. A page with five
 * or six of these firing at once starves the browser's per-host connection
 * limit — each one pulls in a dozen-plus chunk requests — and the widgets
 * lower on the page simply never finish loading. Watching for the widget to
 * scroll into view spreads that load out over time instead of all at once.
 */
function Widget({ file, config, height = 400 }: { file: string; config: Record<string, unknown>; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // 400px of runway so the widget is already loading by the time it's
    // actually in frame, rather than popping in as the reader scrolls to it.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = host.current;
    if (!el) return;
    setStatus('loading');
    el.replaceChildren();

    const mount = document.createElement('div');
    mount.className = 'tradingview-widget-container';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    mount.appendChild(inner);

    const script = document.createElement('script');
    script.src = `${BASE}${file}.js`;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = configKey;
    script.onload = () => setStatus('ready');
    script.onerror = () => setStatus('error');

    // Same ordering constraint as the chart embed: the container has to be
    // live in the document before the script runs, because the widget
    // resolves its mount point from `document.currentScript`.
    el.appendChild(mount);
    mount.appendChild(script);

    return () => {
      el.replaceChildren();
    };
  }, [visible, file, configKey, attempt]);

  return (
    <div className="relative">
      <div ref={host} style={{ minHeight: height }} />
      {status !== 'ready' && (
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-lg bg-surface-1/60 text-xs ${
            status === 'error' ? '' : 'pointer-events-none'
          }`}
          aria-live="polite"
        >
          {status === 'loading' || status === 'waiting' ? (
            <ChartSkeleton />
          ) : (
            <div className="w-full max-w-xs px-4">
              <ErrorState message="Couldn't reach TradingView" onRetry={() => setAttempt((n) => n + 1)} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Buy/sell/neutral rating for one symbol, rolled up from its own indicators —
 * a second, independent read alongside the raw chart. */
export function TechnicalAnalysisWidget({ symbol, height = 425 }: { symbol: string; height?: number }) {
  return (
    <Widget
      file="technical-analysis"
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
