import type { LedgerEvent } from './types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function previousMonthKey(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 2, 1); // m is 1-indexed; -2 steps back one month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Running balance: every income event credits it, every expense debits it. Pass
 * `asOf` to compute the balance as of a past point in time instead of now. */
export function totalBalance(events: LedgerEvent[], asOf?: string): number {
  const cutoff = asOf ? new Date(asOf).getTime() : Infinity;
  let total = 0;
  for (const e of events) {
    if (new Date(e.timestamp).getTime() > cutoff) continue;
    if (e.type === 'income') total += e.amount;
    else if (e.type === 'expense') total -= e.amount;
  }
  return roundCents(total);
}

export interface BalancePoint {
  timestamp: string;
  value: number;
}

export function endOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0, 23, 59, 59, 999).toISOString();
}

/** One point per month that had any activity, valued at the running balance as of the
 * end of that month. */
export function balanceSeries(events: LedgerEvent[]): BalancePoint[] {
  return monthsWithActivity(events).map((month) => ({
    timestamp: endOfMonth(month),
    value: totalBalance(events, endOfMonth(month)),
  }));
}

export function spendByCategoryForMonth(events: LedgerEvent[], month: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.type === 'expense' && monthKey(e.timestamp) === month) {
      out[e.category] = roundCents((out[e.category] ?? 0) + e.amount);
    }
  }
  return out;
}

export function totalSpendForMonth(events: LedgerEvent[], month: string): number {
  return Object.values(spendByCategoryForMonth(events, month)).reduce((s, v) => s + v, 0);
}

/** Sum of income event amounts logged within a given month. */
export function totalIncomeForMonth(events: LedgerEvent[], month: string): number {
  let total = 0;
  for (const e of events) {
    if (e.type === 'income' && monthKey(e.timestamp) === month) total += e.amount;
  }
  return roundCents(total);
}

/** Total expense outflow for a month. */
export function totalOutflowForMonth(events: LedgerEvent[], month: string): number {
  let total = 0;
  for (const e of events) {
    if (e.type === 'expense' && monthKey(e.timestamp) === month) total += e.amount;
  }
  return roundCents(total);
}

/** Distinct months (YYYY-MM) that appear in the ledger, sorted ascending. */
export function monthsWithActivity(events: LedgerEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (e.type === 'income' || e.type === 'expense') set.add(monthKey(e.timestamp));
  }
  return Array.from(set).sort();
}
