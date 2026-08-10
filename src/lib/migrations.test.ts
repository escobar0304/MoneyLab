import { describe, it, expect } from 'vitest';
import { normalizeEvents, mergeEvents } from './migrations';
import { foldRecurring, foldPostedMonths } from './entities';
import type { LedgerEvent } from './types';

const legacy: LedgerEvent[] = [
  {
    id: 'a',
    type: 'salary_upsert',
    timestamp: '2026-01-01T00:00:00.000Z',
    salary: { id: 'sal-1', amount: 3000, cycle: 'monthly', startDate: '2026-01-01T00:00:00.000Z' },
  },
  { id: 'b', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 3000, label: 'Monthly salary', salaryId: 'sal-1' },
  { id: 'c', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 20, category: 'Coffee' },
];

describe('normalizeEvents', () => {
  it('rewrites salary_upsert into a recurring rule', () => {
    const [first] = normalizeEvents(legacy);
    expect(first).toMatchObject({
      type: 'recurring_upsert',
      rule: { id: 'sal-1', kind: 'income', label: 'Monthly salary', amount: 3000, active: true },
    });
  });

  it('rewrites salaryId to recurringId without changing which month is paid', () => {
    const migrated = normalizeEvents(legacy);
    const payment = migrated.find((e) => e.type === 'income');
    expect(payment).toMatchObject({ recurringId: 'sal-1' });
    expect(payment).not.toHaveProperty('salaryId');
    expect(foldPostedMonths(migrated).has('sal-1:2026-01')).toBe(true);
  });

  it('is idempotent — running it twice changes nothing', () => {
    const once = normalizeEvents(legacy);
    expect(normalizeEvents(once)).toEqual(once);
  });

  it('carries a v1 ledger through to the unified rule shape', () => {
    const v1: LedgerEvent[] = [
      {
        id: 'r1',
        type: 'recurring_income_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        income: { id: 'inc-1', label: 'Retainer', amount: 500, cycle: 'monthly', startDate: '2026-01-01T00:00:00.000Z', active: true },
      },
      { id: 'r2', type: 'recurring_income_remove', timestamp: '2026-02-01T00:00:00.000Z', incomeId: 'gone' },
      { id: 'r3', type: 'recurring_income_skip', timestamp: '2026-02-01T00:00:00.000Z', recurringId: 'inc-1', month: '2026-02' },
    ];
    const migrated = normalizeEvents(v1);
    expect(migrated.map((e) => e.type)).toEqual(['recurring_upsert', 'recurring_remove', 'recurring_skip']);
    expect(foldRecurring(migrated)[0]).toMatchObject({ id: 'inc-1', kind: 'income', label: 'Retainer' });
  });

  it('takes a v0 ledger all the way to v2 in one pass', () => {
    expect(normalizeEvents(legacy).some((e) => e.type === 'recurring_upsert')).toBe(true);
    expect(normalizeEvents(legacy).some((e) => e.type === 'salary_upsert')).toBe(false);
  });

  it('drops malformed entries rather than crashing the whole load', () => {
    const dirty = [...legacy, null, { id: 'x' }, 'nope'] as unknown as LedgerEvent[];
    expect(normalizeEvents(dirty)).toHaveLength(3);
  });
});

describe('mergeEvents', () => {
  const mine: LedgerEvent[] = [
    { id: '1', type: 'expense', timestamp: '2026-01-02T00:00:00.000Z', amount: 10, category: 'Coffee' },
    { id: '2', type: 'expense', timestamp: '2026-01-03T00:00:00.000Z', amount: 20, category: 'Rent' },
  ];

  it('adds only what is missing and reports duplicates', () => {
    const theirs: LedgerEvent[] = [
      { id: '2', type: 'expense', timestamp: '2026-01-03T00:00:00.000Z', amount: 20, category: 'Rent' },
      { id: '3', type: 'expense', timestamp: '2026-01-01T00:00:00.000Z', amount: 30, category: 'Gym' },
    ];
    const { merged, added, duplicates } = mergeEvents(mine, theirs);
    expect({ added, duplicates }).toEqual({ added: 1, duplicates: 1 });
    expect(merged.map((e) => e.id)).toEqual(['3', '1', '2']); // sorted by timestamp
  });

  it('never drops an entry the current ledger already had', () => {
    const { merged } = mergeEvents(mine, []);
    expect(merged.map((e) => e.id).sort()).toEqual(['1', '2']);
  });

  it('normalizes legacy events on the way in', () => {
    const { merged } = mergeEvents([], legacy);
    expect(merged.some((e) => e.type === 'salary_upsert')).toBe(false);
    expect(merged.some((e) => e.type === 'recurring_upsert')).toBe(true);
  });

  it('merging the same file twice is a no-op the second time', () => {
    const first = mergeEvents(mine, legacy);
    const second = mergeEvents(first.merged, legacy);
    expect(second.added).toBe(0);
    expect(second.merged).toHaveLength(first.merged.length);
  });
});
