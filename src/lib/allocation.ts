import type { AllocationRule, AllocationResult, ID } from './types';
import { UNALLOCATED_BUCKET_ID } from './types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Splits `amount` across `rules`. Percent/fixed rules are computed first; whatever
 * remains (amount - fixed - percent, which may be negative if over-allocated) is
 * split across any 'remainder' rules, or falls into the Unallocated bucket if none.
 * Rules with subRules recursively split their own share instead of crediting
 * their own bucket directly.
 */
export function allocate(amount: number, rules: AllocationRule[]): AllocationResult[] {
  const totals = new Map<ID, number>();
  const add = (bucketId: ID, value: number) => {
    totals.set(bucketId, (totals.get(bucketId) ?? 0) + value);
  };
  const applyRule = (rule: AllocationRule, base: number) => {
    if (rule.subRules && rule.subRules.length > 0) {
      for (const r of allocate(base, rule.subRules)) add(r.bucketId, r.amount);
    } else {
      add(rule.bucketId, base);
    }
  };

  const fixedRules = rules.filter((r) => r.mode === 'fixed');
  const percentRules = rules.filter((r) => r.mode === 'percent');
  const remainderRules = rules.filter((r) => r.mode === 'remainder');

  const fixedSum = fixedRules.reduce((s, r) => s + r.value, 0);
  const percentSum = percentRules.reduce((s, r) => s + (amount * r.value) / 100, 0);
  const remainder = roundCents(amount - fixedSum - percentSum);

  for (const rule of fixedRules) applyRule(rule, rule.value);
  for (const rule of percentRules) applyRule(rule, (amount * rule.value) / 100);

  if (remainderRules.length > 0) {
    const share = remainder / remainderRules.length;
    for (const rule of remainderRules) applyRule(rule, share);
  } else if (remainder !== 0) {
    add(UNALLOCATED_BUCKET_ID, remainder);
  }

  return Array.from(totals.entries())
    .map(([bucketId, value]) => ({ bucketId, amount: roundCents(value) }))
    .filter((r) => r.amount !== 0);
}

/**
 * Per-rule base amounts at a single level (before recursing into subRules) — used by
 * the rule builder UI to preview each row's $ share, including its slice of any
 * shared remainder.
 */
export function ruleBaseAmounts(amount: number, rules: AllocationRule[]): Map<ID, number> {
  const fixedRules = rules.filter((r) => r.mode === 'fixed');
  const percentRules = rules.filter((r) => r.mode === 'percent');
  const remainderRules = rules.filter((r) => r.mode === 'remainder');

  const fixedSum = fixedRules.reduce((s, r) => s + r.value, 0);
  const percentSum = percentRules.reduce((s, r) => s + (amount * r.value) / 100, 0);
  const remainder = roundCents(amount - fixedSum - percentSum);
  const remainderShare = remainderRules.length > 0 ? remainder / remainderRules.length : 0;

  const out = new Map<ID, number>();
  for (const r of rules) {
    if (r.mode === 'fixed') out.set(r.id, roundCents(r.value));
    else if (r.mode === 'percent') out.set(r.id, roundCents((amount * r.value) / 100));
    else out.set(r.id, roundCents(remainderShare));
  }
  return out;
}

export function unallocatedRemainder(amount: number, rules: AllocationRule[]): number {
  const hasRemainderRule = rules.some((r) => r.mode === 'remainder');
  if (hasRemainderRule) return 0;
  const fixedSum = rules.filter((r) => r.mode === 'fixed').reduce((s, r) => s + r.value, 0);
  const percentSum = rules.filter((r) => r.mode === 'percent').reduce((s, r) => s + (amount * r.value) / 100, 0);
  return roundCents(amount - fixedSum - percentSum);
}
