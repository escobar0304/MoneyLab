import { describe, it, expect } from 'vitest';
import { allocate } from './allocation';
import { UNALLOCATED_BUCKET_ID } from './types';
import type { AllocationRule } from './types';

function rule(partial: Partial<AllocationRule> & Pick<AllocationRule, 'bucketId' | 'mode'>): AllocationRule {
  return { id: partial.bucketId + '-rule', value: 0, ...partial };
}

describe('allocate', () => {
  it('splits a percent-only set of rules exactly', () => {
    const rules = [
      rule({ bucketId: 'rent', mode: 'percent', value: 30 }),
      rule({ bucketId: 'invest', mode: 'percent', value: 20 }),
      rule({ bucketId: 'subs', mode: 'percent', value: 5 }),
      rule({ bucketId: 'savings', mode: 'percent', value: 15 }),
      rule({ bucketId: 'fun', mode: 'remainder' }),
    ];
    const result = allocate(1000, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    expect(byBucket.rent).toBe(300);
    expect(byBucket.invest).toBe(200);
    expect(byBucket.subs).toBe(50);
    expect(byBucket.savings).toBe(150);
    expect(byBucket.fun).toBe(300); // remainder
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(1000);
  });

  it('handles fixed amounts plus an explicit remainder bucket', () => {
    const rules = [
      rule({ bucketId: 'rent', mode: 'fixed', value: 800 }),
      rule({ bucketId: 'groceries', mode: 'fixed', value: 200 }),
      rule({ bucketId: 'leftover', mode: 'remainder' }),
    ];
    const result = allocate(1200, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    expect(byBucket.rent).toBe(800);
    expect(byBucket.groceries).toBe(200);
    expect(byBucket.leftover).toBe(200);
  });

  it('sends leftover to the Unallocated bucket when no remainder rule exists', () => {
    const rules = [rule({ bucketId: 'rent', mode: 'percent', value: 30 })];
    const result = allocate(1000, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    expect(byBucket.rent).toBe(300);
    expect(byBucket[UNALLOCATED_BUCKET_ID]).toBe(700);
  });

  it('reflects over-allocation as a negative Unallocated amount', () => {
    const rules = [
      rule({ bucketId: 'rent', mode: 'fixed', value: 900 }),
      rule({ bucketId: 'car', mode: 'fixed', value: 300 }),
    ];
    const result = allocate(1000, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    expect(byBucket[UNALLOCATED_BUCKET_ID]).toBe(-200);
  });

  it('recursively splits nested sub-allocations', () => {
    const rules = [
      rule({
        bucketId: 'investments',
        mode: 'percent',
        value: 30,
        subRules: [
          rule({ bucketId: 'stocks', mode: 'percent', value: 60 }),
          rule({ bucketId: 'crypto', mode: 'percent', value: 40 }),
        ],
      }),
      rule({ bucketId: 'rest', mode: 'remainder' }),
    ];
    const result = allocate(1000, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    // 30% of 1000 = 300; 60/40 split of that = 180 / 120
    expect(byBucket.stocks).toBe(180);
    expect(byBucket.crypto).toBe(120);
    expect(byBucket.investments).toBeUndefined(); // fully redistributed to sub-buckets
    expect(byBucket.rest).toBe(700);
  });

  it('merges repeated bucket ids across rules into a single total', () => {
    const rules = [
      rule({ bucketId: 'savings', mode: 'fixed', value: 50 }),
      rule({ bucketId: 'savings', mode: 'percent', value: 10 }),
    ];
    const result = allocate(500, rules);
    const byBucket = Object.fromEntries(result.map((r) => [r.bucketId, r.amount]));
    expect(byBucket.savings).toBe(100); // 50 fixed + 50 (10% of 500)
  });
});
