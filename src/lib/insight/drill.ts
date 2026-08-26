import type { ID, LedgerEvent, MoneyEvent } from '../core/types';
import { isMoneyEvent } from '../core/types';
import { monthKey } from '../core/derive';
import { accountIdOf } from '../money/accounts';

/**
 * A slice of the ledger, described by what a chart mark means.
 *
 * Every field narrows, and they are ANDed. The shape is deliberately small: a
 * chart mark is always some combination of a period, a kind and a grouping, and
 * anything richer than that belongs in search, not in a click target.
 */
export interface EntryFilter {
  /** YYYY-MM. */
  month?: string;
  /** Inclusive ISO date bounds, for marks that aren't a whole month. */
  from?: string;
  to?: string;
  type?: 'income' | 'expense';
  category?: string;
  /**
   * Several categories at once — how an "Other" bucket drills, since the mark
   * stands for the tail of the ranking rather than for one name.
   */
  categories?: string[];
  accountId?: ID;
}

/** What a chart mark opens: the slice, plus what the mark said it was. */
export interface Drill {
  title: string;
  subtitle?: string;
  filter: EntryFilter;
}

function inRange(timestamp: string, filter: EntryFilter): boolean {
  if (filter.month && monthKey(timestamp) !== filter.month) return false;
  const day = timestamp.slice(0, 10);
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

/**
 * The entries behind a mark, newest first.
 *
 * This is the whole of the drill-down feature. It works because the charts were
 * never showing anything other than these same events grouped — so the path back
 * from a picture to the rows underneath it is a filter, not a second index that
 * could fall out of step with what was drawn.
 */
export function selectEntries(events: LedgerEvent[], filter: EntryFilter): MoneyEvent[] {
  const categories = filter.categories ? new Set(filter.categories) : null;

  return events
    .filter(isMoneyEvent)
    .filter((e) => {
      if (filter.type && e.type !== filter.type) return false;
      if (!inRange(e.timestamp, filter)) return false;
      if (filter.accountId && accountIdOf(e) !== filter.accountId) return false;
      if (filter.category !== undefined) {
        if (e.type !== 'expense' || e.category !== filter.category) return false;
      }
      if (categories) {
        if (e.type !== 'expense' || !categories.has(e.category)) return false;
      }
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface DrillTotals {
  income: number;
  expense: number;
  net: number;
  count: number;
}

/** The sums for a drilled slice, so the panel can say whether it adds up to the
 * figure the mark showed — the point of opening it. */
export function drillTotals(entries: MoneyEvent[]): DrillTotals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === 'income') income += e.amount;
    else expense += e.amount;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { income: round(income), expense: round(expense), net: round(income - expense), count: entries.length };
}
