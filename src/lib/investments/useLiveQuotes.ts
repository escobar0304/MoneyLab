import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../core/store';
import { foldHoldings } from '../core/entities';

/**
 * How often prices are refreshed. Most venues here report on a fifteen-minute
 * delay, so anything faster would mostly re-fetch the same number; a minute is
 * frequent enough to feel live without being pointless traffic.
 */
const REFRESH_MS = 60_000;

const ENABLED_KEY = 'moneylab-live-prices';

export function livePricesEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== '0';
}

/**
 * The scheduler. Mounted exactly once, at the top of the app.
 *
 * Once, because Net worth on the Overview is only honest if the portfolio
 * behind it is priced, and mounting this in each panel that shows a price would
 * multiply every request by the number of panels. Panels read the results and
 * call `refreshQuotes` from the store instead — see `useLivePrices`.
 *
 * Paused while the tab is hidden: a background tab polling a third party every
 * minute for hours is rude and buys nothing, since the price is re-fetched the
 * moment the tab comes back.
 */
export function useLiveQuoteScheduler(): void {
  const events = useStore((s) => s.events);
  const refreshQuotes = useStore((s) => s.refreshQuotes);
  const [enabled, setEnabled] = useState(livePricesEnabled);

  // Symbols as a stable string, so this re-runs when the holdings change but
  // not on every unrelated ledger write.
  const symbolKey = foldHoldings(events)
    .map((h) => h.symbol.toUpperCase())
    .sort()
    .join(',');

  // The toggle lives in localStorage, so this picks up a change made in a panel.
  useEffect(() => {
    const sync = () => setEnabled(livePricesEnabled());
    window.addEventListener('moneylab-live-prices-changed', sync);
    return () => window.removeEventListener('moneylab-live-prices-changed', sync);
  }, []);

  useEffect(() => {
    if (!enabled || !symbolKey) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      void refreshQuotes();
      timer = setInterval(() => void refreshQuotes(), REFRESH_MS);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [enabled, symbolKey, refreshQuotes]);
}

export interface LivePriceControls {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  refresh: () => void;
}

/** Status and controls for any panel that shows prices. Starts no timers. */
export function useLivePrices(): LivePriceControls {
  const status = useStore((s) => s.quoteStatus);
  const refreshQuotes = useStore((s) => s.refreshQuotes);
  const [enabled, setEnabledState] = useState(livePricesEnabled);

  const setEnabled = useCallback(
    (on: boolean) => {
      localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
      setEnabledState(on);
      // Tells the scheduler, which lives in a different component.
      window.dispatchEvent(new Event('moneylab-live-prices-changed'));
      if (on) void refreshQuotes();
    },
    [refreshQuotes]
  );

  return {
    enabled,
    setEnabled,
    loading: status.loading,
    error: status.error,
    lastFetchedAt: status.lastFetchedAt,
    refresh: () => void refreshQuotes(),
  };
}
