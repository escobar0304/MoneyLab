import { useEffect, useRef, useState } from 'react';
import { CHART_INK } from '../../lib/insight/chartTheme';
import { ErrorState } from '../ui/primitives';
import { ChartSkeleton } from '../ui/Skeleton';

const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

export type Interval = '5' | '15' | '60' | 'D' | 'W' | 'M';
export type Style = '1' | '2' | '3';

/**
 * TradingView's Advanced Chart embed.
 *
 * The widget is a third-party script that replaces the contents of its own
 * container, so it is mounted into a throwaway inner node that React never
 * touches — letting React own a node the script also mutates is how these
 * embeds end up throwing `removeChild` errors on unmount.
 *
 * Re-keying on every config value forces a full teardown and rebuild: the
 * widget reads its options once at construction and offers no update API.
 */
export function TradingViewChart({
  symbol,
  interval,
  style,
  height = 520,
}: {
  symbol: string;
  interval: Interval;
  style: Style;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // Bumped by Retry. The embed offers no reload of its own, so the only way
  // back from a failed script load is to tear the whole thing down and build
  // it again — which is what re-running this effect does.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setStatus('loading');
    el.replaceChildren();

    const mount = document.createElement('div');
    mount.className = 'tradingview-widget-container';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = `${height}px`;
    mount.appendChild(inner);

    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height,
      symbol,
      interval,
      timezone: 'Europe/Lisbon',
      theme: 'dark',
      style,
      locale: 'en',
      // Match the app's own surface so the embed doesn't read as a foreign panel.
      backgroundColor: CHART_INK.surface,
      gridColor: CHART_INK.gridline,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    script.onload = () => setStatus('ready');
    script.onerror = () => setStatus('error');

    // Attach the container first, then the script. A <script> appended to a
    // detached subtree only runs once that subtree lands in the document, and
    // the embed resolves its mount point from `document.currentScript`, so it
    // has to already be parented in the live DOM when it executes.
    el.appendChild(mount);
    mount.appendChild(script);

    return () => {
      el.replaceChildren();
    };
  }, [symbol, interval, style, height, attempt]);

  return (
    <div className="relative">
      <div ref={host} style={{ minHeight: height }} />
      {status !== 'ready' && (
        <div
          // Only the loading veil stays click-through; the error state has a
          // button in it, and a pointer-events-none overlay would swallow it.
          className={`absolute inset-0 flex items-center justify-center rounded-lg bg-surface-1/60 text-sm ${
            status === 'loading' ? 'pointer-events-none' : ''
          }`}
          aria-live="polite"
        >
          {status === 'loading' ? (
            <ChartSkeleton label={`Loading ${symbol}…`} />
          ) : (
            <div className="max-w-sm px-6">
              <ErrorState
                message="Couldn't reach TradingView"
                detail="This panel needs an internet connection — the rest of MoneyLab works offline."
                onRetry={() => setAttempt((n) => n + 1)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
