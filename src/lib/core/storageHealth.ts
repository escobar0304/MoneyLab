/**
 * Whether the last write to `localStorage` actually landed.
 *
 * The ledger is append-only and never prunes, so it grows for as long as the
 * app is used. `localStorage` caps an origin at a few megabytes, and when that
 * cap is hit `setItem` throws — but by then React state has already updated,
 * so the entry appears in the UI, looks saved, and is gone on the next reload.
 * Silent loss of exactly the data the app exists to keep.
 *
 * This module is the channel between the storage layer (which is outside
 * React and cannot render anything) and the banner that tells the reader.
 * A module-level value plus an event, matching how `navigate.ts` already
 * bridges the same gap.
 */

export type WriteFailure = {
  /** True when the browser refused the write for lack of room, as opposed to
   * refusing storage outright (Safari's private mode does the latter). */
  outOfRoom: boolean;
  at: string;
};

const EVENT = 'moneylab:storage-write-failed';

let current: WriteFailure | null = null;

/**
 * Chromium reports code 22, Firefox 1014, and both set a name — but a private
 * window can throw a plain SecurityError instead, which is a different problem
 * with a different fix, so the two are told apart rather than lumped together.
 */
function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

export function reportWriteFailure(error: unknown): void {
  current = { outOfRoom: isQuotaError(error), at: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent<WriteFailure>(EVENT, { detail: current }));
}

/** Called after any write that succeeds, so a warning clears itself once the
 * reader has made room rather than sitting there until a reload. */
export function clearWriteFailure(): void {
  if (!current) return;
  current = null;
  window.dispatchEvent(new CustomEvent<WriteFailure | null>(EVENT, { detail: null }));
}

export function getWriteFailure(): WriteFailure | null {
  return current;
}

/** Returns an unsubscribe function, for a `useEffect` cleanup. */
export function onWriteFailure(handler: (failure: WriteFailure | null) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<WriteFailure | null>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
