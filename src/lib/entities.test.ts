import { describe, it, expect } from 'vitest';
import {
  foldRecurring,
  foldCategories,
  foldBudgets,
  foldPostedMonths,
  foldSkips,
  foldCleared,
  reconcile,
  renameCategoryIn,
} from './entities';
import { normalizeEvents } from './migrations';
import { occurrencesUpTo } from './recurrence';
import type { LedgerEvent } from './types';

const rule = (over: Partial<LedgerEvent & { rule: unknown }> = {}) => ({ cycle: 'monthly' as const, startDate: '2026-01-01T00:00:00.000Z', active: true, ...over });

describe('foldRecurring', () => {
  it('migrates a legacy salary into an income rule', () => {
    const events = normalizeEvents([
      {
        id: '1',
        type: 'salary_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        salary: { id: 'sal-1', amount: 3000, cycle: 'monthly', startDate: '2026-01-01T00:00:00.000Z' },
      },
    ]);
    expect(foldRecurring(events)[0]).toMatchObject({ id: 'sal-1', kind: 'income', label: 'Monthly salary', amount: 3000, active: true });
  });

  it('applies later upserts and drops removed rules', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'recurring_upsert', timestamp: '2026-01-01T00:00:00.000Z', rule: { ...rule(), id: 'a', kind: 'income', label: 'Salary', amount: 3000 } },
      { id: '2', type: 'recurring_upsert', timestamp: '2026-02-01T00:00:00.000Z', rule: { ...rule(), id: 'b', kind: 'expense', label: 'Rent', amount: 900, category: 'Rent' } },
      { id: '3', type: 'recurring_upsert', timestamp: '2026-03-01T00:00:00.000Z', rule: { ...rule(), id: 'a', kind: 'income', label: 'Salary', amount: 3200 } },
      { id: '4', type: 'recurring_remove', timestamp: '2026-03-02T00:00:00.000Z', recurringId: 'b' },
    ];
    const rules = foldRecurring(events);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: 'a', amount: 3200 });
  });

  it('filters by kind so income and expense managers never see each other', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'recurring_upsert', timestamp: '2026-01-01T00:00:00.000Z', rule: { ...rule(), id: 'a', kind: 'income', label: 'Salary', amount: 3000 } },
      { id: '2', type: 'recurring_upsert', timestamp: '2026-01-01T00:00:00.000Z', rule: { ...rule(), id: 'b', kind: 'expense', label: 'Rent', amount: 900, category: 'Rent' } },
    ];
    expect(foldRecurring(events, 'income').map((r) => r.id)).toEqual(['a']);
    expect(foldRecurring(events, 'expense').map((r) => r.id)).toEqual(['b']);
  });
});

describe('recurring generation', () => {
  const income = { id: 'a', kind: 'income' as const, label: 'Salary', amount: 3000, cycle: 'monthly' as const, startDate: '2026-01-01T00:00:00.000Z', active: true };

  it('emits one occurrence per elapsed month, inclusive of the start', () => {
    const dates = occurrencesUpTo(income, new Date('2026-04-15T00:00:00.000Z'));
    expect(dates.map((d) => d.toISOString().slice(0, 7))).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });

  it('does not slip a month backwards across a DST boundary', () => {
    const dates = occurrencesUpTo(income, new Date('2026-06-15T00:00:00.000Z'));
    expect(dates.map((d) => d.toISOString().slice(0, 7))).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('clamps a 31st start to short months without the day sticking', () => {
    const dates = occurrencesUpTo({ ...income, startDate: '2026-01-31T00:00:00.000Z' }, new Date('2026-05-15T00:00:00.000Z'));
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('counts posted months for expenses as well as income', () => {
    const posted = foldPostedMonths([
      { id: 'p1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 3000, label: 'Salary', recurringId: 'a' },
      { id: 'p2', type: 'expense', timestamp: '2026-01-02T00:00:00.000Z', amount: 900, category: 'Rent', recurringId: 'b' },
    ]);
    expect(posted.has('a:2026-01')).toBe(true);
    expect(posted.has('b:2026-01')).toBe(true);
  });

  it('honours a skip so a deleted entry is not regenerated', () => {
    const skips = foldSkips([{ id: 's1', type: 'recurring_skip', timestamp: '2026-03-02T00:00:00.000Z', recurringId: 'a', month: '2026-02' }]);
    expect(skips.has('a:2026-02')).toBe(true);
  });

  it('returns nothing for an unparseable start date instead of looping', () => {
    expect(occurrencesUpTo({ ...income, startDate: 'not-a-date' }, new Date('2026-04-01T00:00:00.000Z'))).toEqual([]);
  });
});

describe('foldCategories', () => {
  it('offers created categories, used ones, and those named by a recurring rule', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'category_upsert', timestamp: '2026-01-01T00:00:00.000Z', name: 'Rent' },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 20, category: 'Coffee' },
      { id: '3', type: 'recurring_upsert', timestamp: '2026-01-01T00:00:00.000Z', rule: { ...rule(), id: 'r', kind: 'expense', label: 'Netflix', amount: 8, category: 'Subscriptions' } },
    ];
    expect(foldCategories(events)).toEqual(['Coffee', 'Rent', 'Subscriptions']);
  });

  it('drops removed categories even when an expense still uses them', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 20, category: 'Coffee' },
      { id: '2', type: 'category_remove', timestamp: '2026-02-01T00:00:00.000Z', name: 'Coffee' },
    ];
    expect(foldCategories(events)).toEqual([]);
  });

  it('re-adding a removed category brings it back', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'category_upsert', timestamp: '2026-01-01T00:00:00.000Z', name: 'Coffee' },
      { id: '2', type: 'category_remove', timestamp: '2026-02-01T00:00:00.000Z', name: 'Coffee' },
      { id: '3', type: 'category_upsert', timestamp: '2026-03-01T00:00:00.000Z', name: 'Coffee' },
    ];
    expect(foldCategories(events)).toEqual(['Coffee']);
  });
});

describe('foldBudgets', () => {
  it('keeps the latest limit per category', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'budget_set', timestamp: '2026-01-01T00:00:00.000Z', category: 'Food', amount: 300 },
      { id: '2', type: 'budget_set', timestamp: '2026-02-01T00:00:00.000Z', category: 'Food', amount: 350 },
    ];
    expect(foldBudgets(events).get('Food')).toBe(350);
  });

  it('clearing removes the limit', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'budget_set', timestamp: '2026-01-01T00:00:00.000Z', category: 'Food', amount: 300 },
      { id: '2', type: 'budget_clear', timestamp: '2026-02-01T00:00:00.000Z', category: 'Food' },
    ];
    expect(foldBudgets(events).size).toBe(0);
  });

  it('removing a category takes its budget with it', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'budget_set', timestamp: '2026-01-01T00:00:00.000Z', category: 'Food', amount: 300 },
      { id: '2', type: 'category_remove', timestamp: '2026-02-01T00:00:00.000Z', name: 'Food' },
    ];
    expect(foldBudgets(events).size).toBe(0);
  });
});

const expense = (id: string, category: string, amount = 10, timestamp = '2026-03-01T00:00:00.000Z'): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp,
  amount,
  category,
});

describe('renameCategoryIn', () => {
  const base: LedgerEvent[] = [
    { id: 'c1', type: 'category_upsert', timestamp: '2026-01-01T00:00:00.000Z', name: 'Food' },
    { id: 'c2', type: 'category_upsert', timestamp: '2026-01-01T00:00:00.000Z', name: 'Rent' },
    expense('e1', 'Food'),
    expense('e2', 'Rent'),
    { id: 'b1', type: 'budget_set', timestamp: '2026-01-01T00:00:00.000Z', category: 'Food', amount: 300 },
  ];

  it('renames the category on every entry, the picker and the budget', () => {
    const { events, merged } = renameCategoryIn(base, 'Food', 'Groceries');
    expect(merged).toBe(false);
    expect(foldCategories(events)).toEqual(['Groceries', 'Rent']);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Groceries')).toHaveLength(1);
    expect(foldBudgets(events).get('Groceries')).toBe(300);
    expect(foldBudgets(events).has('Food')).toBe(false);
  });

  it('renames the category named by a recurring rule', () => {
    // Otherwise the next generated charge would quietly recreate the old name.
    const withRule: LedgerEvent[] = [
      ...base,
      {
        id: 'r1',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'r', kind: 'expense', label: 'Weekly shop', amount: 50, category: 'Food', cycle: 'monthly', startDate: '2026-01-01', active: true },
      },
    ];
    const { events } = renameCategoryIn(withRule, 'Food', 'Groceries');
    expect(foldRecurring(events, 'expense')[0].category).toBe('Groceries');
    expect(foldCategories(events)).not.toContain('Food');
  });

  it('merges into an existing category, moving its entries', () => {
    const { events, merged } = renameCategoryIn(base, 'Food', 'Rent');
    expect(merged).toBe(true);
    expect(foldCategories(events)).toEqual(['Rent']);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Rent')).toHaveLength(2);
  });

  it('drops the source budget on a merge so the target keeps its own', () => {
    const withBoth: LedgerEvent[] = [
      ...base,
      { id: 'b2', type: 'budget_set', timestamp: '2026-02-01T00:00:00.000Z', category: 'Rent', amount: 900 },
    ];
    // Rewriting the source's limit onto the target would let whichever was set
    // most recently silently win.
    const { events } = renameCategoryIn(withBoth, 'Food', 'Rent');
    expect(foldBudgets(events).get('Rent')).toBe(900);
    expect(foldBudgets(events).size).toBe(1);
  });

  it('treats a case fix as a rename, not a merge into itself', () => {
    const { events, merged } = renameCategoryIn(base, 'Food', 'food');
    expect(merged).toBe(false);
    // localeCompare collates case-insensitively, so "food" sorts before "Rent".
    expect(foldCategories(events)).toEqual(['food', 'Rent']);
  });

  it('leaves the ledger untouched for an empty or identical name', () => {
    expect(renameCategoryIn(base, 'Food', '  ').events).toBe(base);
    expect(renameCategoryIn(base, 'Food', 'Food').events).toBe(base);
  });

  it('does not touch other categories', () => {
    const { events } = renameCategoryIn(base, 'Food', 'Groceries');
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Rent')).toHaveLength(1);
  });
});

describe('foldCleared', () => {
  it('tracks the latest assertion per entry', () => {
    const events: LedgerEvent[] = [
      expense('e1', 'Food'),
      { id: 'k1', type: 'entry_cleared', timestamp: '2026-03-02T00:00:00.000Z', entryId: 'e1', cleared: true },
    ];
    expect(foldCleared(events).has('e1')).toBe(true);
  });

  it('lets an entry be un-ticked again', () => {
    const events: LedgerEvent[] = [
      expense('e1', 'Food'),
      { id: 'k1', type: 'entry_cleared', timestamp: '2026-03-02T00:00:00.000Z', entryId: 'e1', cleared: true },
      { id: 'k2', type: 'entry_cleared', timestamp: '2026-03-03T00:00:00.000Z', entryId: 'e1', cleared: false },
    ];
    expect(foldCleared(events).has('e1')).toBe(false);
  });
});

describe('reconcile', () => {
  const events: LedgerEvent[] = [
    { id: 'i1', type: 'income', timestamp: '2026-03-01T00:00:00.000Z', amount: 1000, label: 'Salary' },
    expense('e1', 'Food', 200),
    expense('e2', 'Rent', 300),
    { id: 'k1', type: 'entry_cleared', timestamp: '2026-03-04T00:00:00.000Z', entryId: 'i1', cleared: true },
    { id: 'k2', type: 'entry_cleared', timestamp: '2026-03-04T00:00:00.000Z', entryId: 'e1', cleared: true },
  ];

  it('splits the balance into verified and not', () => {
    // 1000 in and 200 out are ticked off; the 300 rent is not.
    expect(reconcile(events)).toEqual({ clearedBalance: 800, unclearedBalance: -300, clearedCount: 2, unclearedCount: 1 });
  });

  it('can be scoped to the entries on screen', () => {
    expect(reconcile(events, new Set(['e1', 'e2']))).toMatchObject({ clearedBalance: -200, unclearedBalance: -300 });
  });

  it('counts nothing as cleared when nothing has been ticked', () => {
    expect(reconcile([events[0], events[1]])).toMatchObject({ clearedBalance: 0, clearedCount: 0, unclearedCount: 2 });
  });
});
