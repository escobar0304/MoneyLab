import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '../ui/primitives';
import { ChartSkeleton } from '../ui/Skeleton';
import { embedTarget, sandboxFor } from '../../lib/markets/embedOrigin';

/**
 * A TradingView widget, kept out of this app's origin.
 *
 * These embeds used to be `<script src="s3.tradingview.com/…">` appended
 * straight into the page. That is third-party code executing in our own
 * origin, which means it can read `localStorage` — where the entire ledger
 * lives. The app's first promise is that nothing leaves the device, and that
 * promise was worth exactly as much as TradingView's CDN was trustworthy on
 * any given day.
 *
 * Framing it with `sandbox` and no `allow-same-origin` gives the embed an
 * opaque origin. The widget still draws and still talks to its own servers;
 * it simply cannot see anything of ours, because the browser no longer
 * believes it is us. `allow-popups` stays because the charts link out to
 * TradingView, and that is the reader's choice to make.
 */
export function SandboxedEmbed({
  widget,
  config,
  height = 400,
  /** Waits for the frame to be near the viewport before loading it. A page
   * with six of these firing at once starves the browser's per-host connection
   * limit and the lower ones never finish. */
  lazy = true,
  title,
}: {
  widget: string;
  config: Record<string, unknown>;
  height?: number;
  lazy?: boolean;
  title: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'error'>(lazy ? 'waiting' : 'loading');
  const [attempt, setAttempt] = useState(0);

  // Keyed on the serialised config, not the object.
  //
  // Every caller passes an object literal, so the reference is new on each of
  // its renders — and a changed `src` reloads the frame. Depending on the
  // identity would have the chart tear itself down and start again whenever
  // anything unrelated on the Markets tab re-rendered, losing whatever the
  // reader had zoomed or drawn.
  const configKey = JSON.stringify(config);
  const target = useMemo(() => embedTarget(), []);
  const src = useMemo(() => {
    const params = new URLSearchParams({ w: widget, h: String(height), c: configKey });
    // `attempt` is in the URL rather than only a key on the element: changing
    // the src is what actually makes the browser fetch the widget again.
    return `${target.origin}/embed.html?${params.toString()}&r=${attempt}`;
  }, [widget, height, configKey, attempt, target.origin]);

  useEffect(() => {
    if (!lazy) return;
    const el = host.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStatus((s) => (s === 'waiting' ? 'loading' : s));
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy]);

  // The frame cannot be inspected from here — that is the entire point — so it
  // reports for itself. Messages are matched on the sending window rather than
  // on an origin, which for a sandboxed frame is the opaque string "null" and
  // therefore identifies nothing.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      // Once the frame has a real origin of its own, check it. The source-window
      // test above is what carries the same-origin-less case, where `event.origin`
      // is the opaque string "null" and identifies nothing.
      if (target.isolated && event.origin !== target.origin) return;
      const data = event.data as { moneylab?: string; state?: string } | null;
      if (!data || data.moneylab !== 'embed') return;
      if (data.state === 'ready' || data.state === 'error') setStatus(data.state);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [target.isolated, target.origin]);

  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  return (
    <div ref={host} className="relative" style={{ minHeight: height }}>
      {status !== 'waiting' && (
        <iframe
          ref={frame}
          key={attempt}
          src={src}
          title={title}
          // `allow-same-origin` appears only when the frame is served from an
          // origin that is provably not this app's — see `embedOrigin.ts` for
          // why the chart needs it and why granting it same-origin would be
          // worse than no sandbox at all.
          sandbox={sandboxFor(target)}
          referrerPolicy="no-referrer"
          className="w-full border-0"
          style={{ height }}
          onError={() => setStatus('error')}
        />
      )}

      {status !== 'ready' && (
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-lg bg-surface-1/60 ${
            status === 'error' ? '' : 'pointer-events-none'
          }`}
          aria-live="polite"
        >
          {status === 'error' ? (
            <div className="w-full max-w-sm px-4">
              <ErrorState
                message="Couldn't reach TradingView"
                detail="This panel needs an internet connection — the rest of MoneyLab works offline."
                onRetry={retry}
              />
            </div>
          ) : (
            <ChartSkeleton />
          )}
        </div>
      )}
    </div>
  );
}
