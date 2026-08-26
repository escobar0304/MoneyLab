import type { LedgerEvent } from '../core/types';
import { totalBalance, totalIncomeForMonth, totalOutflowForMonth, endOfMonth } from '../core/derive';
import type { ReviewKind } from './review';

export interface ReplayPoint {
  /** Short label for the point: a month's name for a year, a day number for a month. */
  label: string;
  /** ISO timestamp at the end of this point's window — what `balance` is as of. */
  date: string;
  /** Running balance as of the end of this point. */
  balance: number;
  income: number;
  spend: number;
  /** The single largest expense within this point's window, if any. */
  topExpense: { category: string; amount: number } | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Built from the numeric components directly, never by re-parsing a UTC
 * instant into local getters — that round-trip shifts the day itself for
 * anyone west of UTC, the same class of bug `recurrence.ts` documents. */
function endOfDayUtc(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
}

function biggestExpense(events: LedgerEvent[], from: number, to: number): { category: string; amount: number } | null {
  let biggest: { category: string; amount: number } | null = null;
  for (const e of events) {
    if (e.type !== 'expense') continue;
    const t = new Date(e.timestamp).getTime();
    if (t < from || t > to) continue;
    if (!biggest || e.amount > biggest.amount) biggest = { category: e.category, amount: e.amount };
  }
  return biggest;
}

/**
 * A day-by-day (for a month) or month-by-month (for a year) trace of the
 * balance, for the animated "replay" — the same figures `buildPeriodReview`
 * already sums for the static recap, just read back one point at a time
 * instead of collapsed into one total.
 *
 * Stops at `now` rather than running past it: a replay of the current,
 * still-in-progress period has nothing to show for days or months that
 * haven't happened yet.
 */
export function buildReplay(events: LedgerEvent[], kind: ReviewKind, period: string, now: Date = new Date()): ReplayPoint[] {
  const points: ReplayPoint[] = [];

  if (kind === 'year') {
    const year = Number(period);
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;
      const cutoff = endOfMonth(monthStr);
      if (new Date(cutoff).getTime() > now.getTime()) break;
      const from = new Date(Date.UTC(year, m - 1, 1)).getTime();
      points.push({
        label: MONTH_NAMES[m - 1],
        date: cutoff,
        balance: totalBalance(events, cutoff),
        income: totalIncomeForMonth(events, monthStr),
        spend: totalOutflowForMonth(events, monthStr),
        topExpense: biggestExpense(events, from, new Date(cutoff).getTime()),
      });
    }
  } else {
    const [year, month] = period.split('-').map(Number);
    const total = daysInMonth(year, month);
    for (let day = 1; day <= total; day++) {
      const from = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
      const cutoff = endOfDayUtc(year, month, day);
      const cutoffMs = new Date(cutoff).getTime();
      if (cutoffMs > now.getTime()) break;

      let income = 0;
      let spend = 0;
      for (const e of events) {
        const t = new Date(e.timestamp).getTime();
        if (t < from || t > cutoffMs) continue;
        if (e.type === 'income') income += e.amount;
        else if (e.type === 'expense') spend += e.amount;
      }

      points.push({
        label: String(day),
        date: cutoff,
        balance: totalBalance(events, cutoff),
        income,
        spend,
        topExpense: biggestExpense(events, from, cutoffMs),
      });
    }
  }

  return points;
}
