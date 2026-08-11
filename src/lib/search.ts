import type { LedgerEvent, MoneyEvent } from './types';
import { isMoneyEvent } from './types';

/**
 * Folds away case and accents.
 *
 * Accent folding is not a nicety here: the categories in this app are written in
 * Portuguese, so "alimentacao" typed quickly must find "Alimentação". Without
 * it, search fails exactly on the words that are hardest to type.
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Everything about an entry that is worth matching against, as one string. */
function haystack(entry: MoneyEvent): string {
  const parts: string[] = [
    entry.type === 'income' ? entry.label : entry.category,
    entry.type === 'expense' ? (entry.subcategory ?? '') : '',
    entry.type === 'expense' ? (entry.note ?? '') : '',
    // Both separators, so "42.5" and "42,5" both find the same charge.
    String(entry.amount),
    String(entry.amount).replace('.', ','),
    entry.foreign?.currency ?? '',
    entry.timestamp.slice(0, 10),
  ];
  return fold(parts.join(' '));
}

/**
 * True when every whitespace-separated term appears somewhere in the entry.
 *
 * All terms rather than any, so adding a word narrows the result instead of
 * widening it — which is what a person expects when the first search returned
 * too much.
 */
export function matchesQuery(entry: MoneyEvent, query: string): boolean {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const target = haystack(entry);
  return terms.every((term) => target.includes(term));
}

/**
 * Every entry matching the query, newest first, across the whole ledger.
 *
 * Deliberately not scoped to a month. The reason to search at all is that you
 * do not remember when something happened — a search that only looked inside
 * the month already on screen would answer a question nobody has.
 */
export function searchEntries(events: LedgerEvent[], query: string): MoneyEvent[] {
  if (!query.trim()) return [];
  return events
    .filter(isMoneyEvent)
    .filter((e) => matchesQuery(e, query))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
