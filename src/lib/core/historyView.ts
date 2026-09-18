/**
 * Which month the history is showing, and a way to ask it to show another.
 *
 * This exists because of a bug worth stating plainly: the entry form lets you
 * date an expense into any month, and the history only ever renders one. Log a
 * receipt from July while looking at September and the ledger gains an event,
 * the screen changes by nothing at all, and the only way to find out whether it
 * worked is to go looking. Measured before this was written — the stored event
 * count went 98 → 99 while the visible row count stayed at 8.
 *
 * Silence after a write is the one feedback failure that actively costs the
 * reader something: with no confirmation, the reasonable thing to do is log it
 * again.
 *
 * A module-level value plus an event, mirroring `navigate.ts`, because the form
 * and the history are siblings and the alternative is threading state through a
 * parent that has no use for it. The form reads `shownMonth` to decide whether
 * what it just posted is somewhere the reader can actually see, and says so
 * only when it isn't — a confirmation that fires when the row is already
 * animating in beside it is noise.
 */

const EVENT = 'moneylab:show-month';

/** `YYYY-MM`, or null before the history has mounted and published one. */
let shownMonth: string | null = null;

/** Published by the history whenever the month it renders changes. */
export function setShownMonth(month: string): void {
  shownMonth = month;
}

export function getShownMonth(): string | null {
  return shownMonth;
}

/** Asks the history to move to `month`. No-op if nothing is listening. */
export function requestMonth(month: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: month }));
}

/** Returns an unsubscribe function, for a `useEffect` cleanup. */
export function onMonthRequest(handler: (month: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Test seam — the module-level value would otherwise leak between cases. */
export function resetShownMonth(): void {
  shownMonth = null;
}
