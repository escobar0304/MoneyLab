import type { ExpenseEvent, LedgerEvent } from '../core/types';
import { foldWorthIt } from '../core/entities';
import { monthKey } from '../core/derive';

/** Below this, a purchase is day-to-day and not worth a verdict on. */
export const WORTH_IT_DEFAULT_THRESHOLD = 50;

/** How long to let a purchase settle before asking about it — long enough
 * that the initial excitement (or regret) has worn off. */
export const WORTH_IT_DELAY_DAYS = 7;

const THRESHOLD_KEY = 'moneylab-worth-it-threshold';

export function readWorthItThreshold(): number {
  const stored = localStorage.getItem(THRESHOLD_KEY);
  if (stored === null) return WORTH_IT_DEFAULT_THRESHOLD;
  const raw = Number(stored);
  return Number.isFinite(raw) && raw >= 0 ? raw : WORTH_IT_DEFAULT_THRESHOLD;
}

export function writeWorthItThreshold(value: number): void {
  localStorage.setItem(THRESHOLD_KEY, String(Math.max(0, value)));
}

export interface PendingWorthIt {
  entry: ExpenseEvent;
  daysAgo: number;
}

/**
 * Big-enough, old-enough purchases with no verdict yet, oldest first.
 *
 * Never a recurring bill — paying rent again isn't a decision to reflect on.
 * And only a split purchase's *first* instalment: the decision to buy was
 * made once, when it was split, not again with every monthly payment.
 */
export function pendingWorthItChecks(
  events: LedgerEvent[],
  threshold: number = readWorthItThreshold(),
  now: Date = new Date()
): PendingWorthIt[] {
  const verdicts = foldWorthIt(events);
  const out: PendingWorthIt[] = [];

  for (const e of events) {
    if (e.type !== 'expense') continue;
    if (e.amount < threshold) continue;
    if (e.recurringId) continue;
    if (e.splitCount && e.splitIndex !== 1) continue;
    if (verdicts.has(e.id)) continue;

    const daysAgo = Math.floor((now.getTime() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo < WORTH_IT_DELAY_DAYS) continue;

    out.push({ entry: e, daysAgo });
  }

  return out.sort((a, b) => new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime());
}

export interface WorthItStats {
  answered: number;
  yes: number;
}

/** How the big purchases answered so far in a set of months panned out —
 * folded the same way `buildPeriodReview` sums everything else per period. */
export function worthItStatsForMonths(events: LedgerEvent[], months: Set<string>): WorthItStats {
  const verdicts = foldWorthIt(events);
  let answered = 0;
  let yes = 0;

  for (const e of events) {
    if (e.type !== 'expense' || !months.has(monthKey(e.timestamp))) continue;
    const verdict = verdicts.get(e.id);
    if (verdict === undefined) continue;
    answered++;
    if (verdict) yes++;
  }

  return { answered, yes };
}
