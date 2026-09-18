import { useEffect, useRef } from 'react';

/**
 * Which items in a list showed up since the last render.
 *
 * Logging an entry is the single most repeated action in this app, and until
 * now it produced no feedback at all: the row simply existed on the next paint,
 * indistinguishable from the eighty rows that were already there. This is the
 * hook that lets exactly the new one announce itself.
 *
 * Three things it has to get right, each of which is a way the naive version
 * goes wrong:
 *
 * 1. **Nothing is new on the first render.** Otherwise opening the app animates
 *    every row on the page at once, which reads as a loading screen rather than
 *    as an arrival.
 * 2. **A bulk arrival is not an arrival.** Importing a statement adds hundreds
 *    of rows; animating them individually is a storm, not feedback. Past
 *    `BULK_THRESHOLD` the whole batch is treated as "just how the list looks
 *    now", which is also how the reader experiences it.
 * 3. **It must survive a double render.** StrictMode renders twice in
 *    development, so the bookkeeping happens in an effect, after commit — a
 *    version that mutated its record during render would mark the new rows as
 *    already-seen on the second pass and animate nothing.
 */

/** Above this many at once it is an import, not something the reader just did. */
const BULK_THRESHOLD = 8;

const EMPTY: ReadonlySet<string> = new Set();

export function useArrivals(ids: readonly string[]): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);

  // Computed during render rather than in the effect, because the row needs to
  // know on the very paint it first appears in — a class applied one frame
  // later has already missed the entrance.
  let arrived: ReadonlySet<string> = EMPTY;
  if (seen.current !== null) {
    const fresh = new Set<string>();
    for (const id of ids) if (!seen.current.has(id)) fresh.add(id);
    if (fresh.size > 0 && fresh.size <= BULK_THRESHOLD) arrived = fresh;
  }

  useEffect(() => {
    seen.current = new Set(ids);
  });

  return arrived;
}
