import type { LedgerEvent } from './types';
import {
  balanceSeries,
  monthsWithActivity,
  spendByCategoryForMonth,
  totalIncomeForMonth,
  totalOutflowForMonth,
  previousMonthKey,
} from './derive';
import { savingsRateSeries, budgetStatuses } from './analysis';
import { formatMoney, formatDate, monthLabel } from './format';

export interface TableData {
  columns: string[];
  rows: string[][];
  /** Right-aligned columns, by index — numbers read better against the edge. */
  numeric: number[];
}

/**
 * The table twin of each chart.
 *
 * Every chart needs one: a chart encodes values as position and colour, both of
 * which are unavailable to a screen reader and unreliable under colour-vision
 * deficiency. These are built from the same derive functions the charts use, so
 * the two can never disagree about what the data is.
 */

export function netWorthTable(events: LedgerEvent[]): TableData {
  return {
    columns: ['Month end', 'Balance'],
    rows: balanceSeries(events)
      .slice(-6)
      .map((p) => [formatDate(p.timestamp), formatMoney(p.value)]),
    numeric: [1],
  };
}

export function incomeVsExpensesTable(events: LedgerEvent[]): TableData {
  return {
    columns: ['Month', 'Income', 'Expenses', 'Net'],
    rows: monthsWithActivity(events)
      .slice(-6)
      .map((m) => {
        const income = totalIncomeForMonth(events, m);
        const spend = totalOutflowForMonth(events, m);
        return [monthLabel(m), formatMoney(income), formatMoney(spend), formatMoney(income - spend)];
      }),
    numeric: [1, 2, 3],
  };
}

export function spendByCategoryTable(events: LedgerEvent[], month: string): TableData {
  const byCategory = spendByCategoryForMonth(events, month);
  const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
  return {
    columns: ['Category', 'Spent', 'Share'],
    rows: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => [name, formatMoney(value), total > 0 ? `${Math.round((value / total) * 100)}%` : '—']),
    numeric: [1, 2],
  };
}

export function categoryChangeTable(events: LedgerEvent[], month: string): TableData {
  const current = spendByCategoryForMonth(events, month);
  const previous = spendByCategoryForMonth(events, previousMonthKey(month));
  const names = Array.from(new Set([...Object.keys(current), ...Object.keys(previous)])).sort(
    (a, b) => (current[b] ?? 0) - (current[a] ?? 0)
  );
  return {
    columns: ['Category', monthLabel(previousMonthKey(month)), monthLabel(month), 'Change'],
    rows: names.map((name) => {
      const then = previous[name] ?? 0;
      const now = current[name] ?? 0;
      const delta = now - then;
      return [name, formatMoney(then), formatMoney(now), `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatMoney(Math.abs(delta))}`];
    }),
    numeric: [1, 2, 3],
  };
}

export function spendOverTimeTable(events: LedgerEvent[]): TableData {
  const months = monthsWithActivity(events).slice(-6);
  const categories = Array.from(new Set(months.flatMap((m) => Object.keys(spendByCategoryForMonth(events, m))))).sort();
  return {
    columns: ['Month', ...categories, 'Total'],
    rows: months.map((m) => {
      const byCategory = spendByCategoryForMonth(events, m);
      const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
      return [monthLabel(m), ...categories.map((c) => formatMoney(byCategory[c] ?? 0)), formatMoney(total)];
    }),
    numeric: categories.map((_, i) => i + 1).concat([categories.length + 1]),
  };
}

export function savingsRateTable(events: LedgerEvent[]): TableData {
  return {
    columns: ['Month', 'Income', 'Spent', 'Saved', 'Rate'],
    rows: savingsRateSeries(events)
      .slice(-12)
      .map((p) => [
        monthLabel(p.month),
        formatMoney(p.income),
        formatMoney(p.spend),
        formatMoney(p.saved),
        p.rate === null ? '—' : `${p.rate.toFixed(1)}%`,
      ]),
    numeric: [1, 2, 3, 4],
  };
}

export function budgetsTable(events: LedgerEvent[], budgets: Map<string, number>, month: string): TableData {
  return {
    columns: ['Category', 'Spent', 'Limit', 'Used', 'State'],
    rows: budgetStatuses(events, budgets, month).map((s) => [
      s.category,
      formatMoney(s.spent),
      formatMoney(s.limit),
      `${Math.round(s.ratio * 100)}%`,
      s.state === 'over' ? 'Over budget' : s.state === 'close' ? 'Close to limit' : 'On track',
    ]),
    numeric: [1, 2, 3],
  };
}
