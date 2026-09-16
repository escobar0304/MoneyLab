import type { LedgerEvent, LedgerEventType } from './types';

/**
 * Whether a parsed file is actually a ledger, checked properly.
 *
 * The old check asked only whether `id`, `type` and `timestamp` were strings,
 * which any object with three string fields satisfies. That is the wrong bar
 * for the one input this app takes from outside itself: an import is merged
 * into an append-only log that every figure in the product is derived from, so
 * a malformed event is not a bad row — it is a permanent wrong number in a
 * chart, with no obvious way back to the file that caused it.
 *
 * A file is rejected whole rather than partially imported. Half a ledger is a
 * worse outcome than none, because it looks like it worked.
 */

/** Every `type` a `LedgerEvent` can carry, including the v0/v1 shapes that
 * `normalizeEvents` migrates forward — an old export must still import. */
const VALID_TYPES: ReadonlySet<string> = new Set<LedgerEventType>([
  'income',
  'expense',
  'recurring_upsert',
  'recurring_remove',
  'recurring_skip',
  'budget_set',
  'budget_clear',
  'holding_upsert',
  'holding_remove',
  'trade',
  'dividend',
  'goal_upsert',
  'goal_remove',
  'goal_contribution',
  'debt_upsert',
  'debt_remove',
  'entry_cleared',
  'worth_it',
  'deduction_map',
  'deduction_cap',
  'account_upsert',
  'account_remove',
  'transfer',
  'rule_upsert',
  'rule_remove',
  'category_upsert',
  'category_remove',
  'challenge_upsert',
  'challenge_remove',
  'vehicle_upsert',
  'vehicle_remove',
  'recurring_income_upsert',
  'recurring_income_remove',
  'recurring_income_skip',
  'salary_upsert',
]);

/**
 * An upper bound on how much a single file may carry.
 *
 * Not a security boundary so much as a guard against pasting the wrong file:
 * a few hundred thousand events is already far more than a lifetime of daily
 * logging, and folding an unbounded array would hang the tab before anything
 * could report why.
 */
const MAX_EVENTS = 500_000;

/** Keys that mean something to the JavaScript object model rather than to the
 * ledger. `JSON.parse` makes them ordinary own properties, so they cannot
 * pollute a prototype on their own — but nothing legitimate writes them, and a
 * file that does is not a file to merge into the record of your finances. */
const RESERVED_KEYS = ['__proto__', 'constructor', 'prototype'];

export type ImportCheck = { ok: true; events: LedgerEvent[] } | { ok: false; reason: string };

export function validateImport(value: unknown): ImportCheck {
  if (!Array.isArray(value)) return { ok: false, reason: 'That file is not a ledger export — it should hold a list of events.' };
  if (value.length > MAX_EVENTS) {
    return { ok: false, reason: `That file holds ${value.length.toLocaleString()} events, well past anything this can be.` };
  }

  for (let i = 0; i < value.length; i++) {
    const reason = checkEvent(value[i], i);
    if (reason) return { ok: false, reason };
  }

  return { ok: true, events: value as LedgerEvent[] };
}

function checkEvent(event: unknown, index: number): string | null {
  const at = `Event ${index + 1}`;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return `${at} is not an event.`;

  const e = event as Record<string, unknown>;
  for (const key of RESERVED_KEYS) {
    if (Object.hasOwn(e, key)) return `${at} carries a reserved key (${key}).`;
  }

  if (typeof e.id !== 'string' || e.id === '') return `${at} has no id.`;
  if (typeof e.type !== 'string') return `${at} has no type.`;
  if (!VALID_TYPES.has(e.type)) return `${at} has an unknown type (${e.type}).`;

  if (typeof e.timestamp !== 'string' || Number.isNaN(Date.parse(e.timestamp))) {
    return `${at} has no readable timestamp.`;
  }

  // The two that move money are worth checking past their envelope: an amount
  // that is a string, a NaN or an Infinity poisons every total derived from it,
  // and does so silently.
  if (e.type === 'income' || e.type === 'expense') {
    if (typeof e.amount !== 'number' || !Number.isFinite(e.amount)) return `${at} has no usable amount.`;
  }
  if (e.type === 'expense' && typeof e.category !== 'string') return `${at} is an expense with no category.`;

  return null;
}
