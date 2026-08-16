import type { ID, LedgerEvent, MoneyEvent, Rule, RuleCondition } from './types';
import { isMoneyEvent } from './types';
import { fold } from './search';
import { accountIdOf } from './accounts';

/** Current rules, in the order they were first created — which is also the order
 * they are applied in. */
export function foldRules(events: LedgerEvent[]): Rule[] {
  const byId = new Map<ID, Rule>();
  for (const e of events) {
    if (e.type === 'rule_upsert') {
      // `set` on an existing key keeps its original position, which is what
      // makes editing a rule leave application order alone — and order is part
      // of what a rule means, since later rules win.
      byId.set(e.rule.id, { ...e.rule });
    } else if (e.type === 'rule_remove') {
      byId.delete(e.ruleId);
    }
  }
  return Array.from(byId.values());
}

/** The text a rule's `text` condition is tested against — what the entry is
 * about, and nothing else. Amount and date have their own fields, so folding
 * them in here would make "text contains 12" match a €12 charge. */
function ruleText(entry: MoneyEvent): string {
  const parts =
    entry.type === 'income'
      ? [entry.label]
      : [entry.category, entry.subcategory ?? '', entry.note ?? ''];
  return fold(parts.join(' '));
}

function matchesCondition(entry: MoneyEvent, condition: RuleCondition): boolean {
  const { field, op, value } = condition;

  if (field === 'amount') {
    const threshold = Number(value.replace(',', '.'));
    if (!Number.isFinite(threshold)) return false;
    if (op === 'gte') return entry.amount >= threshold;
    if (op === 'lte') return entry.amount <= threshold;
    if (op === 'equals') return Math.abs(entry.amount - threshold) < 0.005;
    return false; // `contains` is meaningless for a number
  }

  const needle = fold(value).trim();
  if (needle === '') return false; // an empty test would match everything

  const haystack = field === 'category' ? (entry.type === 'expense' ? fold(entry.category) : '') : ruleText(entry);
  if (op === 'contains') return haystack.includes(needle);
  if (op === 'equals') return haystack === needle;
  return false;
}

/**
 * True when every condition holds.
 *
 * ANDed, like search: adding a condition narrows the match instead of widening
 * it, which is what someone reaches for after a rule caught too much. A rule
 * with no conditions matches nothing at all — an "always" rule is never what was
 * meant, and would silently recategorise the entire ledger.
 */
export function matchesRule(entry: MoneyEvent, rule: Rule): boolean {
  if (!rule.active) return false;
  if (rule.appliesTo !== 'any' && rule.appliesTo !== entry.type) return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => matchesCondition(entry, c));
}

/**
 * The entry as the rules would have it, or the identical object when nothing
 * matched.
 *
 * Later rules win on the fields they set, so a broad rule can be followed by a
 * narrow correction. Returning the original object on a miss is what lets
 * callers cheaply detect "nothing changed".
 */
export function applyRules(entry: MoneyEvent, rules: Rule[]): MoneyEvent {
  let next = entry;
  for (const rule of rules) {
    if (!matchesRule(next, rule)) continue;
    const { category, subcategory, accountId } = rule.actions;

    if (accountId !== undefined && accountIdOf(next) !== accountId) {
      // Spread through the discriminant rather than the union, so each branch
      // rebuilds a concrete event type.
      next = next.type === 'expense' ? { ...next, accountId } : { ...next, accountId };
    }
    if (next.type === 'expense') {
      if (category !== undefined && category.trim() !== '' && next.category !== category) {
        next = { ...next, category: category.trim() };
      }
      if (subcategory !== undefined && subcategory.trim() !== '' && next.subcategory !== subcategory) {
        next = { ...next, subcategory: subcategory.trim() };
      }
    }
  }
  return next;
}

export interface RuleChange {
  entry: MoneyEvent;
  next: MoneyEvent;
  /** Human-readable "category: Groceries → Food" lines, for the preview. */
  changes: string[];
}

function describeChange(before: MoneyEvent, after: MoneyEvent, accountLabel: (id: ID) => string): string[] {
  const out: string[] = [];
  if (before.type === 'expense' && after.type === 'expense') {
    if (before.category !== after.category) out.push(`Category ${before.category} → ${after.category}`);
    if ((before.subcategory ?? '') !== (after.subcategory ?? '')) {
      out.push(`Subcategory ${before.subcategory || '—'} → ${after.subcategory}`);
    }
  }
  if (accountIdOf(before) !== accountIdOf(after)) {
    out.push(`Account ${accountLabel(accountIdOf(before))} → ${accountLabel(accountIdOf(after))}`);
  }
  return out;
}

/**
 * What running the rules over the whole ledger would change, without changing
 * anything.
 *
 * Retroactive application is the reason to write a rule at all — you notice the
 * pattern *after* the entries exist — but applying it blind across years of
 * history is how someone loses a categorisation they did by hand. So the count
 * and the diff come first, and the action comes second.
 */
export function ruleChanges(events: LedgerEvent[], rules: Rule[], accountLabel: (id: ID) => string): RuleChange[] {
  const out: RuleChange[] = [];
  for (const e of events) {
    if (!isMoneyEvent(e)) continue;
    const next = applyRules(e, rules);
    if (next === e) continue;
    const changes = describeChange(e, next, accountLabel);
    if (changes.length > 0) out.push({ entry: e, next, changes });
  }
  return out;
}

/** How many entries in the ledger a single rule currently matches — shown while
 * editing, so a rule's reach is known before it is saved. */
export function matchCount(events: LedgerEvent[], rule: Rule): number {
  let count = 0;
  for (const e of events) {
    if (isMoneyEvent(e) && matchesRule(e, rule)) count++;
  }
  return count;
}
