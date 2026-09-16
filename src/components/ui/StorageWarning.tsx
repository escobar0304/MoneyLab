import { useEffect, useState } from 'react';
import { getWriteFailure, onWriteFailure, type WriteFailure } from '../../lib/core/storageHealth';
import { rescueExport } from '../../lib/core/rescue';
import { IconWarning } from './icons';

/**
 * Says so, loudly, when a change did not actually get saved.
 *
 * Deliberately not a toast: a toast is right for something that worked, and
 * this is the opposite — every entry logged from here on is being discarded on
 * reload, and that stays true until the reader does something about it. So it
 * sits at the top of the page until the next write succeeds, which is exactly
 * when the problem is genuinely over.
 *
 * The one action offered is the one that helps: get the data out. Pruning the
 * ledger from inside an app that cannot save is not a fix, since the pruning
 * would not save either.
 */
export function StorageWarning() {
  const [failure, setFailure] = useState<WriteFailure | null>(getWriteFailure);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => onWriteFailure(setFailure), []);

  if (!failure) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-critical/30 bg-critical/10 px-4 py-3"
    >
      <IconWarning className="h-5 w-5 shrink-0 text-critical-text" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-critical-text">
          {failure.outOfRoom
            ? "This browser's storage is full — your last change was not saved."
            : 'This browser refused to save — your last change was not stored.'}
        </p>
        <p className="mt-0.5 text-xs text-ink-secondary">
          {failure.outOfRoom
            ? 'Everything already on screen is still here, but it will be gone on reload. Export a copy now, then clear some room.'
            : 'Private browsing and blocked site data both do this. Export a copy now — this session is all there is.'}
        </p>
        {saved && <p className="mt-1 text-xs text-ink-muted">{saved}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          const result = rescueExport();
          setSaved(result.ok ? `Saved ${result.count} entries to your downloads.` : result.reason);
        }}
        className="font-display shrink-0 cursor-pointer rounded-md border border-critical bg-critical px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-200 hover:brightness-110"
      >
        Export now
      </button>
    </div>
  );
}
