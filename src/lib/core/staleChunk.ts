/**
 * Recovering from a tab left open across a deploy.
 *
 * Every view in this app is a `lazy(() => import(...))` of a hash-named chunk,
 * and the service worker is registered with `autoUpdate` — so a new version's
 * worker takes over, cleans out the precache, and the page already on screen
 * keeps running the old JavaScript. The moment the reader opens a tab they had
 * not visited yet, the browser asks for a chunk that no longer exists.
 *
 * What React does with that is throw it into the error boundary, which then
 * says the app crashed and offers to rescue the ledger. Both halves are wrong:
 * nothing crashed, nothing is at risk, and the fix is simply to reload onto the
 * version that is already installed. This module is how the boundary tells that
 * case apart from a real one.
 */

/**
 * How the browsers word it. Checked as substrings because the rest of each
 * message is the chunk URL, and because there is no error code to key on —
 * this is a plain `TypeError` in Chromium and Firefox.
 */
const STALE_CHUNK_MESSAGES = [
  'failed to fetch dynamically imported module', // Chromium
  'error loading dynamically imported module', // Firefox
  'importing a module script failed', // Safari
];

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  return STALE_CHUNK_MESSAGES.some((m) => lower.includes(m));
}

const ATTEMPT_KEY = 'moneylab:chunk-reload-at';

/**
 * How long a reload has to have been ago before another one is allowed.
 *
 * The guard exists because a deploy that is genuinely broken — a chunk missing
 * from the new build, not merely from the old cache — would otherwise reload
 * forever, and an infinite loop is a far worse failure than the error screen it
 * was trying to avoid. Ten seconds is long enough to cover a reload and a click,
 * and short enough that the *next* deploy, weeks later, still recovers by
 * itself rather than being locked out by a flag set once.
 */
const RETRY_AFTER_MS = 10_000;

/**
 * Reloads onto the installed version, at most once per window of time.
 *
 * Returns whether it is reloading, so the caller can render the honest message
 * in the case where it will not. Reloading costs the reader nothing: the ledger
 * is written to `localStorage` on every change, so there is no unsaved state
 * for a reload to lose.
 */
export function recoverFromStaleChunk(): boolean {
  const now = Date.now();
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(ATTEMPT_KEY)) || 0;
  } catch {
    // Private mode can refuse session storage outright. Without somewhere to
    // record the attempt there is no way to detect a loop, so the safe answer
    // is to not start one.
    return false;
  }

  if (now - last < RETRY_AFTER_MS) return false;

  try {
    sessionStorage.setItem(ATTEMPT_KEY, String(now));
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}
