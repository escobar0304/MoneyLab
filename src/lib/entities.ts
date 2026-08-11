import type { LedgerEvent, Recurring, RecurringKind, Holding } from './types';
import { monthKey } from './derive';

/** The recurring id an entry belongs to, tolerating the pre-rename field. */
export function recurringIdOf(e: { recurringId?: string; salaryId?: string }): string | undefined {
  return e.recurringId ?? e.salaryId;
}

/**
 * Folds the ledger into the current set of recurring rules.
 *
 * Expects events already put through `normalizeEvents`, so only the current
 * event shape appears here — the migration owns backwards compatibility, not
 * every fold function.
 */
export function foldRecurring(events: LedgerEvent[], kind?: RecurringKind): Recurring[] {
  const byId = new Map<string, Recurring>();

  for (const e of events) {
    if (e.type === 'recurring_upsert') byId.set(e.rule.id, { ...e.rule });
    else if (e.type === 'recurring_remove') byId.delete(e.recurringId);
  }

  // lastChargedDate derives from the postings themselves rather than being
  // stored, so it can never drift out of step with the ledger.
  for (const e of events) {
    if (e.type !== 'income' && e.type !== 'expense') continue;
    const id = recurringIdOf(e);
    if (!id) continue;
    const rule = byId.get(id);
    if (!rule) continue;
    if (!rule.lastChargedDate || e.timestamp > rule.lastChargedDate) {
      byId.set(id, { ...rule, lastChargedDate: e.timestamp });
    }
  }

  const all = Array.from(byId.values());
  return kind ? all.filter((r) => r.kind === kind) : all;
}

/** Months explicitly marked as "don't post this one", keyed `recurringId:YYYY-MM`. */
export function foldSkips(events: LedgerEvent[]): Set<string> {
  const skips = new Set<string>();
  for (const e of events) {
    if (e.type === 'recurring_skip') skips.add(`${e.recurringId}:${e.month}`);
  }
  return skips;
}

/** Months a rule has already posted, keyed the same way — the guard that makes
 * generation idempotent no matter how often it runs. */
export function foldPostedMonths(events: LedgerEvent[]): Set<string> {
  const posted = new Set<string>();
  for (const e of events) {
    if (e.type !== 'income' && e.type !== 'expense') continue;
    const id = recurringIdOf(e);
    if (id) posted.add(`${id}:${monthKey(e.timestamp)}`);
  }
  return posted;
}

/**
 * Categories available in the picker: the ones explicitly created, plus any
 * already used by an expense or named by a recurring rule, minus removed ones.
 */
export function foldCategories(events: LedgerEvent[]): string[] {
  const known = new Set<string>();
  const removed = new Set<string>();

  for (const e of events) {
    if (e.type === 'category_upsert') {
      known.add(e.name);
      removed.delete(e.name);
    } else if (e.type === 'category_remove') {
      removed.add(e.name);
      known.delete(e.name);
    } else if (e.type === 'expense') {
      known.add(e.category);
    } else if (e.type === 'recurring_upsert' && e.rule.category) {
      known.add(e.rule.category);
    }
  }

  return Array.from(known)
    .filter((name) => !removed.has(name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Rewrites a category name everywhere it appears, merging when `to` exists.
 *
 * The name is changed in place rather than recorded as a rename to resolve at
 * read time. A read-time mapping would have to be applied by every derive,
 * every chart and every table, and the first place it was forgotten would
 * silently show the old name in one panel and the new one everywhere else. One
 * pass here means nothing downstream has to know renaming exists.
 */
export function renameCategoryIn(
  events: LedgerEvent[],
  from: string,
  to: string
): { events: LedgerEvent[]; merged: boolean } {
  const target = to.trim();
  if (!target || target === from) return { events, merged: false };

  // A pure case or accent fix ("groceries" → "Groceries") is a rename, not a
  // merge of the category into itself.
  const merged = foldCategories(events).some((c) => c.toLowerCase() === target.toLowerCase() && c !== from);

  const next = events.flatMap((e): LedgerEvent[] => {
    switch (e.type) {
      case 'expense':
        return e.category === from ? [{ ...e, category: target }] : [e];

      case 'recurring_upsert':
        return e.rule.category === from ? [{ ...e, rule: { ...e.rule, category: target } }] : [e];

      // On a merge the target keeps its own limit and its own place in the
      // picker; the source name ceases to exist entirely, so its configuration
      // goes with it rather than overwriting the target's by being more recent.
      case 'budget_set':
      case 'budget_clear':
        return e.category === from ? (merged ? [] : [{ ...e, category: target }]) : [e];

      case 'category_upsert':
      case 'category_remove':
        return e.name === from ? (merged ? [] : [{ ...e, name: target }]) : [e];

      default:
        return [e];
    }
  });

  return { events: next, merged };
}

/**
 * Entries checked off against the bank. Last assertion per entry wins, so
 * un-ticking something works and leaves the earlier tick in the history.
 */
export function foldCleared(events: LedgerEvent[]): Set<string> {
  const cleared = new Set<string>();
  for (const e of events) {
    if (e.type !== 'entry_cleared') continue;
    if (e.cleared) cleared.add(e.entryId);
    else cleared.delete(e.entryId);
  }
  return cleared;
}

export interface Reconciliation {
  /** Net of the entries ticked off — the figure to compare with the bank. */
  clearedBalance: number;
  /** Net of everything not yet ticked off. */
  unclearedBalance: number;
  clearedCount: number;
  unclearedCount: number;
}

/**
 * The two halves of the balance, split by whether they have been verified.
 *
 * The point of the exercise: if the cleared balance does not match the bank,
 * something is missing or wrong — and that is the only way to find an expense
 * you forgot to log, short of reading the statement line by line every month.
 */
export function reconcile(events: LedgerEvent[], onlyIds?: Set<string>): Reconciliation {
  const cleared = foldCleared(events);
  let clearedBalance = 0;
  let unclearedBalance = 0;
  let clearedCount = 0;
  let unclearedCount = 0;

  for (const e of events) {
    if (e.type !== 'income' && e.type !== 'expense') continue;
    if (onlyIds && !onlyIds.has(e.id)) continue;
    const signed = e.type === 'income' ? e.amount : -e.amount;
    if (cleared.has(e.id)) {
      clearedBalance += signed;
      clearedCount++;
    } else {
      unclearedBalance += signed;
      unclearedCount++;
    }
  }

  return {
    clearedBalance: Math.round(clearedBalance * 100) / 100,
    unclearedBalance: Math.round(unclearedBalance * 100) / 100,
    clearedCount,
    unclearedCount,
  };
}

/** Monthly spending limits by category. */
export function foldBudgets(events: LedgerEvent[]): Map<string, number> {
  const budgets = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'budget_set') budgets.set(e.category, e.amount);
    else if (e.type === 'budget_clear') budgets.delete(e.category);
    // Removing a category takes its budget with it, so a limit can't outlive
    // the thing it limits and quietly reappear if the name is recreated.
    else if (e.type === 'category_remove') budgets.delete(e.name);
  }
  return budgets;
}

/** Current holdings, latest upsert wins, removals drop out. */
export function foldHoldings(events: LedgerEvent[]): Holding[] {
  const byId = new Map<string, Holding>();
  for (const e of events) {
    if (e.type === 'holding_upsert') byId.set(e.holding.id, { ...e.holding });
    else if (e.type === 'holding_remove') byId.delete(e.holdingId);
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}
