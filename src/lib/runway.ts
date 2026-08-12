import type { LedgerEvent } from './types';
import { totalBalance, monthKey } from './derive';
import { foldRecurring, foldPostedMonths, foldSkips } from './entities';
import { occurrencesUpTo } from './recurrence';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A calendar day as YYYY-MM-DD, in UTC to match how the ledger stores dates. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface RunwayItem {
  label: string;
  amount: number;
  kind: 'income' | 'expense';
}

export interface RunwayDay {
  date: string; // YYYY-MM-DD
  /** Balance counting only what is contractually scheduled. */
  scheduled: number;
  /** Scheduled, minus day-to-day spending continuing at its usual rate. */
  expected: number;
  items: RunwayItem[];
}

export interface Runway {
  days: RunwayDay[];
  startingBalance: number;
  /** Average non-recurring spend per day, from recent history. */
  dailyPace: number;
  /** First day the expected balance goes below zero, if any. */
  shortfall: RunwayDay | null;
  /** Days from today until that happens. */
  daysOfRunway: number | null;
  /** The lowest point in the window — useful even when it stays positive. */
  trough: RunwayDay | null;
  /** False when there is too little history for the pace to mean anything. */
  reliable: boolean;
}

/** How far back to look when working out the day-to-day rate. */
const PACE_WINDOW_DAYS = 90;
/** Below this much history, a pace is one big shop extrapolated forever. */
const MIN_PACE_DAYS = 14;

/**
 * Average day-to-day spend, excluding anything a recurring rule generated.
 *
 * Rent must not be smeared across thirty days — it lands on one, and the runway
 * already places it there. Mixing it into the daily rate would count it twice
 * and make every projection far too pessimistic.
 */
function dailySpendPace(events: LedgerEvent[], now: Date): { pace: number; reliable: boolean } {
  const since = new Date(now.getTime() - PACE_WINDOW_DAYS * 86_400_000);
  let total = 0;
  let earliest: number | null = null;

  for (const e of events) {
    if (e.type !== 'expense' || e.recurringId) continue;
    const at = new Date(e.timestamp).getTime();
    if (at < since.getTime() || at > now.getTime()) continue;
    total += e.amount;
    if (earliest === null || at < earliest) earliest = at;
  }

  if (earliest === null) return { pace: 0, reliable: false };

  // Measured over the history that actually exists, not the nominal window —
  // three weeks of data divided by ninety days would understate the rate badly.
  //
  // Counted in whole calendar days, inclusive of both ends: spending 20 a day
  // for ten days is a rate of 20. Dividing by the elapsed *time* instead makes
  // it 21.05, because the last day is only half over — technically true and
  // wrong in the way that matters, since tomorrow is a whole day too.
  const span = Math.max(Math.floor(now.getTime() / 86_400_000) - Math.floor(earliest / 86_400_000) + 1, 1);
  return { pace: roundCents(total / span), reliable: span >= MIN_PACE_DAYS };
}

/**
 * The balance day by day for the weeks ahead.
 *
 * The monthly forecast answers "how will this month end". This answers the
 * question people actually ask mid-month — "do I make it to payday?" — which a
 * month-end total cannot, because it hides the order things happen in. Rent on
 * the 1st and salary on the 28th net out to a fine month and a very bad 20th.
 *
 * Two lines, because they carry different certainties: `scheduled` is what is
 * contractually going to happen, and `expected` adds the assumption that
 * day-to-day spending carries on at its usual rate. The shortfall is read off
 * the second one — the first would cheerfully say you are fine while ignoring
 * every grocery shop.
 */
export function projectRunway(
  events: LedgerEvent[],
  options: { days?: number; now?: Date } = {}
): Runway {
  const days = options.days ?? 60;
  const now = options.now ?? new Date();

  const startingBalance = totalBalance(events);
  const { pace, reliable } = dailySpendPace(events, now);

  // Scheduled charges land on their own dates in the window ahead.
  const horizon = new Date(now.getTime() + days * 86_400_000);
  const posted = foldPostedMonths(events);
  const skipped = foldSkips(events);
  const byDay = new Map<string, RunwayItem[]>();

  for (const rule of foldRecurring(events)) {
    if (!rule.active) continue;
    for (const date of occurrencesUpTo(rule, horizon)) {
      // Everything up to today has either already posted or been deliberately
      // skipped; either way it is in the balance we started from.
      if (date.getTime() <= now.getTime()) continue;
      const key = `${rule.id}:${monthKey(date.toISOString())}`;
      if (posted.has(key) || skipped.has(key)) continue;

      const day = dayKey(date);
      const items = byDay.get(day) ?? [];
      items.push({ label: rule.label, amount: rule.amount, kind: rule.kind });
      byDay.set(day, items);
    }
  }

  const out: RunwayDay[] = [];
  let scheduled = startingBalance;

  for (let i = 1; i <= days; i++) {
    const date = new Date(now.getTime() + i * 86_400_000);
    const key = dayKey(date);
    const items = byDay.get(key) ?? [];

    for (const item of items) scheduled += item.kind === 'income' ? item.amount : -item.amount;
    scheduled = roundCents(scheduled);

    out.push({ date: key, scheduled, expected: roundCents(scheduled - pace * i), items });
  }

  const shortfall = out.find((d) => d.expected < 0) ?? null;
  const trough = out.reduce<RunwayDay | null>((low, d) => (low === null || d.expected < low.expected ? d : low), null);

  return {
    days: out,
    startingBalance,
    dailyPace: pace,
    shortfall,
    daysOfRunway: shortfall ? out.indexOf(shortfall) + 1 : null,
    trough,
    reliable,
  };
}
