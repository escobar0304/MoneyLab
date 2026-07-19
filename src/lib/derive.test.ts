import { describe, it, expect } from 'vitest';
import {
  bucketBalances,
  netWorthAt,
  spendByCategoryForMonth,
  bucketVarianceForMonth,
} from './derive';
import type { LedgerEvent, Bucket } from './types';

const buckets: Bucket[] = [
  { id: 'invest', name: 'Investments', parentId: null, kind: 'investment' },
  { id: 'groceries', name: 'Groceries', parentId: null, kind: 'category' },
];

describe('bucketBalances', () => {
  it('credits income allocations and debits expenses/subscription charges', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck', allocations: [{ bucketId: 'groceries', amount: 200 }, { bucketId: 'invest', amount: 300 }] },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 45, bucketId: 'groceries', category: 'Food' },
      { id: '3', type: 'subscription_charge', timestamp: '2026-01-10T00:00:00.000Z', subscriptionId: 'sub1', amount: 15, bucketId: 'groceries' },
    ];
    const balances = bucketBalances(events);
    expect(balances.groceries).toBe(140); // 200 - 45 - 15
    expect(balances.invest).toBe(300);
  });

  it('respects the asOf cutoff', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck', allocations: [{ bucketId: 'groceries', amount: 200 }] },
      { id: '2', type: 'expense', timestamp: '2026-02-05T00:00:00.000Z', amount: 45, bucketId: 'groceries', category: 'Food' },
    ];
    const balances = bucketBalances(events, '2026-01-15T00:00:00.000Z');
    expect(balances.groceries).toBe(200); // Feb expense excluded
  });
});

describe('netWorthAt', () => {
  it('combines manual snapshot assets/liabilities with live investment bucket balances', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck', allocations: [{ bucketId: 'invest', amount: 400 }] },
      { id: '2', type: 'networth_snapshot', timestamp: '2026-01-02T00:00:00.000Z', assets: [{ name: 'Cash', category: 'cash', amount: 500 }], liabilities: [{ name: 'Credit card', category: 'debt', amount: 100 }] },
    ];
    // manual assets 500 + invested 400 - liabilities 100 = 800
    expect(netWorthAt(events, buckets)).toBe(800);
  });

  it('returns 0 when there are no snapshots and no invested balances', () => {
    expect(netWorthAt([], buckets)).toBe(0);
  });
});

describe('spendByCategoryForMonth', () => {
  it('totals expenses per category within the given month only', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 45, bucketId: 'groceries', category: 'Food' },
      { id: '2', type: 'expense', timestamp: '2026-01-20T00:00:00.000Z', amount: 30, bucketId: 'groceries', category: 'Food' },
      { id: '3', type: 'expense', timestamp: '2026-02-01T00:00:00.000Z', amount: 99, bucketId: 'groceries', category: 'Food' },
    ];
    expect(spendByCategoryForMonth(events, '2026-01')).toEqual({ Food: 75 });
  });
});

describe('bucketVarianceForMonth', () => {
  it('computes allocated vs actual per bucket for a month', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck', allocations: [{ bucketId: 'groceries', amount: 200 }] },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 250, bucketId: 'groceries', category: 'Food' },
    ];
    const result = bucketVarianceForMonth(events, buckets, '2026-01');
    const groceries = result.find((r) => r.bucketId === 'groceries')!;
    expect(groceries.allocated).toBe(200);
    expect(groceries.actual).toBe(250);
    expect(groceries.variance).toBe(-50); // overspent by 50
  });
});
