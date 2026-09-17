import { useState } from 'react';
import { useStore, useIsDemo } from '../../lib/core/store';
import { IconSample } from './icons';

/**
 * Says, on every screen, that the figures below are invented.
 *
 * The one risk demo data carries is being mistaken for real data — which would
 * be a genuinely bad outcome here, because the thing it would be mistaken for
 * is somebody's finances. So this is not dismissible and does not live on one
 * page: it stays until the sample data is actually gone, which is the only
 * moment the statement stops being true.
 *
 * It is drawn in the complement orange rather than the accent blue on purpose.
 * Accent is spent throughout the app on real money — balance, income, net
 * worth — so marking the demo in it would borrow exactly the colour that means
 * "this is yours". Critical red would be wrong in the other direction: nothing
 * is broken.
 */
export function DemoBanner() {
  const isDemo = useIsDemo();
  const clearDemo = useStore((s) => s.clearDemo);
  const [confirming, setConfirming] = useState(false);

  if (!isDemo) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-complement/30 bg-complement/10 px-4 py-3"
    >
      <IconSample className="h-5 w-5 shrink-0 text-complement-hover" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-complement-hover">You are looking at sample data.</p>
        <p className="mt-0.5 text-xs text-ink-secondary">
          Seven months of an invented ledger, so every screen has something in it. Clear it whenever
          you want to start your own — anything you log yourself is kept.
        </p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearDemo();
              setConfirming(false);
            }}
            className="font-display cursor-pointer rounded-md border border-complement bg-complement px-3 py-1.5 text-sm font-semibold text-white transition-[filter] duration-200 hover:brightness-110"
          >
            Clear it
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="font-display cursor-pointer rounded-md border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-secondary transition-colors duration-200 hover:border-border hover:text-ink"
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="font-display shrink-0 cursor-pointer rounded-md border border-complement/40 px-3 py-1.5 text-sm font-semibold text-complement-hover transition-colors duration-200 hover:border-complement hover:bg-complement/10"
        >
          Clear sample data
        </button>
      )}
    </div>
  );
}
