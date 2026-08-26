import type { LedgerEvent } from '../core/types';
import {
  totalIncomeForMonth,
  totalOutflowForMonth,
  spendByCategoryForMonth,
  totalBalance,
  endOfMonth,
  monthKey,
  previousMonthKey,
} from '../core/derive';
import { savingsRateSeries, findAnomalies, type Anomaly } from './analysis';
import { detectSubscriptions } from '../money/subscriptions';
import { worthItStatsForMonths, type WorthItStats } from './worthIt';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ReviewKind = 'month' | 'year';

export interface ReviewCategory {
  category: string;
  amount: number;
  /** Share of this period's spend, 0–100. */
  share: number;
}

export interface ReviewMonth {
  month: string;
  saved: number;
}

export interface SubscriptionSummary {
  count: number;
  undeclared: number;
  drifted: number;
  yearlyTotal: number;
}

export interface PeriodReview {
  kind: ReviewKind;
  /** 'YYYY-MM' for a month, 'YYYY' for a year. */
  period: string;
  months: string[];
  income: number;
  spend: number;
  saved: number;
  /** Null when there was no income to divide by. */
  savingsRatePct: number | null;
  topCategories: ReviewCategory[];
  netWorthStart: number;
  netWorthEnd: number;
  netWorthChange: number;
  biggestSurprise: Anomaly | null;
  subscriptions: SubscriptionSummary;
  /** Year reviews only — the best and worst month by amount saved. */
  bestMonth: ReviewMonth | null;
  worstMonth: ReviewMonth | null;
  /** Null once nothing in the period has a "worth it?" verdict yet. */
  worthIt: WorthItStats | null;
}

/** The month keys a period covers. A year is all twelve, in order, regardless
 * of which of them actually have activity — a review that silently skipped
 * quiet months would make "best month" meaningless. */
function monthsInPeriod(kind: ReviewKind, period: string): string[] {
  if (kind === 'month') return [period];
  const year = Number(period);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** The period containing `now` — this month, or this year. */
export function currentPeriod(kind: ReviewKind, now: Date = new Date()): string {
  const key = monthKey(now.toISOString());
  return kind === 'month' ? key : key.slice(0, 4);
}

/** One period earlier or later — the previous/next month, or calendar year. */
export function shiftPeriod(kind: ReviewKind, period: string, delta: number): string {
  if (kind === 'year') return String(Number(period) + delta);
  const [year, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * A recap of one month or one year — the numbers a "wrapped"-style summary
 * needs, built entirely from what the other derive functions already compute.
 *
 * Nothing here is a new kind of arithmetic; it's the existing per-month
 * figures (income, spend, savings rate, anomalies, subscriptions) summed or
 * picked across whichever months the period covers. A year is just twelve
 * months read at once — which is also why this costs nothing architecturally:
 * the ledger is append-only, so "how did August go" and "how did 2026 go" are
 * both just a filter over the same array Time Travel already proves works.
 */
export function buildPeriodReview(events: LedgerEvent[], kind: ReviewKind, period: string, now: Date = new Date()): PeriodReview {
  const months = monthsInPeriod(kind, period);

  let income = 0;
  let spend = 0;
  const categoryTotals = new Map<string, number>();
  for (const month of months) {
    income += totalIncomeForMonth(events, month);
    spend += totalOutflowForMonth(events, month);
    const byCategory = spendByCategoryForMonth(events, month);
    for (const [category, amount] of Object.entries(byCategory)) {
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
    }
  }
  income = roundCents(income);
  spend = roundCents(spend);
  const saved = roundCents(income - spend);

  const topCategories: ReviewCategory[] = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({
      category,
      amount: roundCents(amount),
      share: spend > 0 ? Math.round((amount / spend) * 100) : 0,
    }));

  // "As of" the end of the month before the period started, and the end of
  // the period itself — or right now, for a period still in progress, so a
  // mid-August review doesn't compare against a month-end that hasn't
  // happened yet.
  const isCurrent = months.includes(monthKey(now.toISOString()));
  const [firstMonth] = months;
  const lastMonth = months[months.length - 1];
  const netWorthStart = totalBalance(events, endOfMonth(previousMonthKey(firstMonth)));
  const netWorthEnd = isCurrent ? totalBalance(events) : totalBalance(events, endOfMonth(lastMonth));
  const netWorthChange = roundCents(netWorthEnd - netWorthStart);

  const anomalies = months.flatMap((month) => findAnomalies(events, month));
  const biggestSurprise = anomalies.length > 0 ? anomalies.reduce((best, a) => (a.score > best.score ? a : best)) : null;

  const allSubs = detectSubscriptions(events);
  const monthSet = new Set(months);
  const inPeriod = allSubs.filter((s) => s.charges.some((c) => monthSet.has(monthKey(c.timestamp))));
  const subscriptions: SubscriptionSummary = {
    count: inPeriod.length,
    undeclared: inPeriod.filter((s) => !s.ruled).length,
    drifted: inPeriod.filter((s) => s.drift).length,
    yearlyTotal: roundCents(inPeriod.reduce((sum, s) => sum + s.yearlyCost, 0)),
  };

  const rawWorthIt = worthItStatsForMonths(events, monthSet);
  const worthIt = rawWorthIt.answered > 0 ? rawWorthIt : null;

  let bestMonth: ReviewMonth | null = null;
  let worstMonth: ReviewMonth | null = null;
  if (kind === 'year') {
    const withIncome = savingsRateSeries(events).filter((p) => monthSet.has(p.month) && p.income > 0);
    for (const p of withIncome) {
      if (!bestMonth || p.saved > bestMonth.saved) bestMonth = { month: p.month, saved: p.saved };
      if (!worstMonth || p.saved < worstMonth.saved) worstMonth = { month: p.month, saved: p.saved };
    }
  }

  return {
    kind,
    period,
    months,
    income,
    spend,
    saved,
    savingsRatePct: income > 0 ? roundCents((saved / income) * 100) : null,
    topCategories,
    netWorthStart,
    netWorthEnd,
    netWorthChange,
    biggestSurprise,
    subscriptions,
    bestMonth,
    worstMonth,
    worthIt,
  };
}

