import type { LedgerEvent, ExpenseEvent } from './types';
import { monthKey, previousMonthKey, totalIncomeForMonth, totalOutflowForMonth, monthsWithActivity, spendByCategoryForMonth } from './derive';
import { foldRecurring, foldSkips, foldPostedMonths } from './entities';
import { occurrencesUpTo } from './recurrence';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Days in a YYYY-MM, and how many have already passed if it's the current month. */
function monthProgress(month: string, now: Date): { daysInMonth: number; elapsed: number; isCurrent: boolean } {
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const isCurrent = monthKey(now.toISOString()) === month;
  if (!isCurrent) {
    // A past month is fully elapsed; a future one hasn't started.
    const started = `${year}-${String(m).padStart(2, '0')}` < monthKey(now.toISOString());
    return { daysInMonth, elapsed: started ? daysInMonth : 0, isCurrent: false };
  }
  return { daysInMonth, elapsed: now.getUTCDate(), isCurrent: true };
}

export interface Forecast {
  /** Spend booked so far this month. */
  actual: number;
  /** Recurring charges scheduled for this month that haven't posted yet. */
  scheduled: number;
  /** Extrapolation of day-to-day spending across the rest of the month. */
  projected: number;
  /** actual + scheduled + projected. */
  total: number;
  daysRemaining: number;
  /** False when there isn't enough of the month elapsed to extrapolate honestly. */
  reliable: boolean;
}

/**
 * Where this month lands if it carries on like this.
 *
 * Split into three parts rather than one number because they have very
 * different certainties: what already happened, what is contractually going to
 * happen (recurring rules), and a straight-line guess at the rest. Only the
 * third is really a forecast, and it is excluded from `reliable` for the first
 * few days, when one big shop would extrapolate to an absurd month.
 */
export function forecastMonth(events: LedgerEvent[], month: string, now: Date = new Date()): Forecast {
  const { daysInMonth, elapsed, isCurrent } = monthProgress(month, now);
  const actual = totalOutflowForMonth(events, month);

  if (!isCurrent) {
    return { actual, scheduled: 0, projected: 0, total: actual, daysRemaining: 0, reliable: true };
  }

  const daysRemaining = Math.max(daysInMonth - elapsed, 0);

  // Recurring expenses due this month that haven't been posted yet.
  const posted = foldPostedMonths(events);
  const skipped = foldSkips(events);
  let scheduled = 0;
  for (const rule of foldRecurring(events, 'expense')) {
    if (!rule.active) continue;
    const key = `${rule.id}:${month}`;
    if (posted.has(key) || skipped.has(key)) continue;
    // Only count it if its occurrence actually falls inside this month.
    const dueThisMonth = occurrencesUpTo(rule, new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))).some(
      (d) => monthKey(d.toISOString()) === month
    );
    if (dueThisMonth) scheduled += rule.amount;
  }

  // Day-to-day spend excludes anything a rule generated, otherwise the rent
  // would be extrapolated as if it happened every day.
  const discretionary = events
    .filter((e): e is ExpenseEvent => e.type === 'expense' && monthKey(e.timestamp) === month && !e.recurringId)
    .reduce((sum, e) => sum + e.amount, 0);

  const perDay = elapsed > 0 ? discretionary / elapsed : 0;
  const projected = perDay * daysRemaining;

  return {
    actual: roundCents(actual),
    scheduled: roundCents(scheduled),
    projected: roundCents(projected),
    total: roundCents(actual + scheduled + projected),
    daysRemaining,
    reliable: elapsed >= 5,
  };
}

export interface SavingsPoint {
  month: string;
  income: number;
  spend: number;
  saved: number;
  /** Percentage of income kept. Null when there was no income to divide by. */
  rate: number | null;
}

/**
 * Savings rate per month — the share of income not spent.
 *
 * Tracked as a rate rather than an amount because the amount rises with income
 * on its own; the rate is what actually says whether habits changed.
 */
export function savingsRateSeries(events: LedgerEvent[]): SavingsPoint[] {
  return monthsWithActivity(events).map((month) => {
    const income = totalIncomeForMonth(events, month);
    const spend = totalOutflowForMonth(events, month);
    return {
      month,
      income,
      spend,
      saved: roundCents(income - spend),
      rate: income > 0 ? roundCents(((income - spend) / income) * 100) : null,
    };
  });
}

/** The same calendar month one year earlier. */
export function sameMonthLastYear(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year - 1}-${String(m).padStart(2, '0')}`;
}

export interface Anomaly {
  event: ExpenseEvent;
  /** How many robust deviations above the category's usual size. */
  score: number;
  median: number;
}

/** Median of a non-empty numeric array. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Minimum history per category before calling anything unusual. Below this,
 * "unusual" is indistinguishable from "second time you bought something". */
const MIN_HISTORY = 5;
const THRESHOLD = 3.5;

/**
 * Expenses that are large compared with what that category normally costs.
 *
 * Uses median absolute deviation rather than mean and standard deviation: a
 * single outlier inflates the standard deviation enough to hide itself, which
 * is precisely the case this is meant to catch. Comparison is per category, so
 * a €900 rent isn't flagged merely for being bigger than a coffee.
 */
export function findAnomalies(events: LedgerEvent[], month: string): Anomaly[] {
  const byCategory = new Map<string, ExpenseEvent[]>();
  for (const e of events) {
    if (e.type !== 'expense') continue;
    const list = byCategory.get(e.category) ?? [];
    list.push(e);
    byCategory.set(e.category, list);
  }

  const anomalies: Anomaly[] = [];
  for (const [, all] of byCategory) {
    // Recurring charges are fixed by a rule, so flagging them says nothing.
    const history = all.filter((e) => !e.recurringId);
    if (history.length < MIN_HISTORY) continue;

    const amounts = history.map((e) => e.amount);
    const med = median(amounts);
    const mad = median(amounts.map((a) => Math.abs(a - med)));
    // A category where every charge is identical has zero deviation; anything
    // different is then infinitely unusual, which is not useful. Fall back to a
    // proportion of the median so the scale stays meaningful.
    const scale = mad > 0 ? mad * 1.4826 : med * 0.25;
    if (scale <= 0) continue;

    for (const e of history) {
      if (monthKey(e.timestamp) !== month) continue;
      const score = (e.amount - med) / scale;
      if (score >= THRESHOLD) anomalies.push({ event: e, score: roundCents(score), median: roundCents(med) });
    }
  }

  return anomalies.sort((a, b) => b.score - a.score);
}

/** Categories over, or close to, their monthly limit. */
export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
  ratio: number;
  state: 'ok' | 'close' | 'over';
}

export function budgetStatuses(events: LedgerEvent[], budgets: Map<string, number>, month: string): BudgetStatus[] {
  const spendByCategory = spendByCategoryForMonth(events, month);
  return Array.from(budgets.entries())
    .map(([category, limit]) => {
      const spent = spendByCategory[category] ?? 0;
      const ratio = limit > 0 ? spent / limit : 0;
      return {
        category,
        limit,
        spent,
        ratio,
        state: ratio > 1 ? ('over' as const) : ratio >= 0.8 ? ('close' as const) : ('ok' as const),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export interface FirstTimeCategory {
  category: string;
  /** What was spent this month — its first month ever. */
  amount: number;
}

export interface QuietCategory {
  category: string;
  /** Average monthly spend over the months it was habitual. */
  usualAmount: number;
}

export interface CategoryNovelty {
  firstTime: FirstTimeCategory[];
  wentQuiet: QuietCategory[];
}

/** Consecutive months of spend before this one that make a category "habitual"
 * enough for its silence to be worth mentioning. */
const HABIT_WINDOW = 3;
/** How much of the current month has to have passed before a habitual
 * category's absence means anything — early on, "not yet" and "not this
 * time" look identical, since plenty of habits land in the second half. */
const QUIET_MIN_ELAPSED_DAYS = 15;

/**
 * Two kinds of surprise `findAnomalies` cannot see, because both are about
 * whether a category showed up at all rather than how big any one charge was:
 * a category with no history before this month, and a category that had
 * spend every month for a while and suddenly has none.
 *
 * Purely informative — there is no "usual" size to compare a first-time
 * category against, and a category going quiet is not necessarily a problem
 * (a subscription cancelled on purpose looks identical to one forgotten).
 * This only ever says what changed, never whether that's good or bad.
 */
export function categoryNovelty(events: LedgerEvent[], month: string, now: Date = new Date()): CategoryNovelty {
  const [year, m] = month.split('-').map(Number);
  const isCurrent = monthKey(now.toISOString()) === month;
  const elapsed = isCurrent ? now.getUTCDate() : new Date(Date.UTC(year, m, 0)).getUTCDate();

  const thisMonth = spendByCategoryForMonth(events, month);

  const firstSeen = new Map<string, string>();
  for (const e of events) {
    if (e.type !== 'expense') continue;
    const seen = firstSeen.get(e.category);
    const at = monthKey(e.timestamp);
    if (!seen || at < seen) firstSeen.set(e.category, at);
  }
  const firstTime: FirstTimeCategory[] = Object.entries(thisMonth)
    .filter(([category]) => firstSeen.get(category) === month)
    .map(([category, amount]) => ({ category, amount: roundCents(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const wentQuiet: QuietCategory[] = [];
  if (elapsed >= QUIET_MIN_ELAPSED_DAYS) {
    const priorMonths: string[] = [];
    for (let i = 0, cursor = month; i < HABIT_WINDOW; i++) {
      cursor = previousMonthKey(cursor);
      priorMonths.push(cursor);
    }
    const priorSpend = priorMonths.map((mo) => spendByCategoryForMonth(events, mo));
    const habitual = Object.keys(priorSpend[0] ?? {}).filter((category) => priorSpend.every((s) => (s[category] ?? 0) > 0));

    for (const category of habitual) {
      if ((thisMonth[category] ?? 0) > 0) continue;
      const usualAmount = roundCents(priorSpend.reduce((sum, s) => sum + (s[category] ?? 0), 0) / HABIT_WINDOW);
      wentQuiet.push({ category, usualAmount });
    }
    wentQuiet.sort((a, b) => b.usualAmount - a.usualAmount);
  }

  return { firstTime, wentQuiet };
}

// Portfolio valuation lives in investments.ts: once a trade log exists, a
// position's cost basis is a function of its trade history rather than of the
// holding record, and having two places compute "what is this worth" is how the
// two answers start to disagree.
