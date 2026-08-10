import type { LedgerEvent, ExpenseEvent, Holding } from './types';
import { monthKey, totalIncomeForMonth, totalOutflowForMonth, monthsWithActivity, spendByCategoryForMonth } from './derive';
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

export interface PortfolioSummary {
  cost: number;
  value: number;
  gain: number;
  /** Gain as a share of cost. Null when nothing has been bought. */
  gainPct: number | null;
  /** Holdings with no price recorded, so their value is counted as cost. */
  unpriced: number;
  /** Oldest price observation still being relied on, or null if none. */
  stalestPriceAt: string | null;
}

/**
 * What the portfolio is worth against what it cost.
 *
 * Holdings without a recorded price fall back to cost rather than being counted
 * as zero — a missing price is unknown, not worthless — and the count is
 * reported so the figure can be qualified rather than quietly overstated.
 */
export function portfolioSummary(holdings: Holding[]): PortfolioSummary {
  let cost = 0;
  let value = 0;
  let unpriced = 0;
  let stalest: string | null = null;

  for (const h of holdings) {
    const holdingCost = h.quantity * h.avgCost;
    cost += holdingCost;
    if (h.lastPrice === undefined) {
      unpriced++;
      value += holdingCost;
    } else {
      value += h.quantity * h.lastPrice;
      if (h.lastPriceAt && (!stalest || h.lastPriceAt < stalest)) stalest = h.lastPriceAt;
    }
  }

  return {
    cost: roundCents(cost),
    value: roundCents(value),
    gain: roundCents(value - cost),
    gainPct: cost > 0 ? roundCents(((value - cost) / cost) * 100) : null,
    unpriced,
    stalestPriceAt: stalest,
  };
}
