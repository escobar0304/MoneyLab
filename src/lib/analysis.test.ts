import { describe, it, expect } from 'vitest';
import { forecastMonth, savingsRateSeries, sameMonthLastYear, findAnomalies, budgetStatuses, categoryNovelty } from './analysis';
import type { LedgerEvent } from './types';

const expense = (id: string, day: number, amount: number, category = 'Food', recurringId?: string): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp: `2026-06-${String(day).padStart(2, '0')}T00:00:00.000Z`,
  amount,
  category,
  recurringId,
});

/** An expense in an arbitrary month, for cross-month novelty tests. */
const expenseIn = (id: string, month: string, amount: number, category: string): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp: `${month}-10T00:00:00.000Z`,
  amount,
  category,
});

describe('forecastMonth', () => {
  const now = new Date('2026-06-10T12:00:00.000Z'); // 10 of 30 days elapsed

  it('extrapolates day-to-day spending across the days left', () => {
    const events = [expense('1', 1, 100), expense('2', 5, 100)]; // 200 over 10 days
    const f = forecastMonth(events, '2026-06', now);
    expect(f.actual).toBe(200);
    expect(f.projected).toBe(400); // 20/day x 20 remaining
    expect(f.total).toBe(600);
    expect(f.daysRemaining).toBe(20);
  });

  it('excludes recurring charges from the pace, so rent is not billed daily', () => {
    const events = [expense('1', 1, 900, 'Rent', 'rule-1'), expense('2', 5, 100)];
    const f = forecastMonth(events, '2026-06', now);
    expect(f.actual).toBe(1000);
    expect(f.projected).toBe(200); // only the 100 counts toward pace
  });

  it('adds recurring charges that are still due this month', () => {
    const events: LedgerEvent[] = [
      {
        id: 'r',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'rule-1', kind: 'expense', label: 'Rent', amount: 900, category: 'Rent', cycle: 'monthly', startDate: '2026-01-20T00:00:00.000Z', active: true },
      },
    ];
    expect(forecastMonth(events, '2026-06', now).scheduled).toBe(900);
  });

  it('does not double-count a recurring charge that already posted', () => {
    const events: LedgerEvent[] = [
      {
        id: 'r',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'rule-1', kind: 'expense', label: 'Rent', amount: 900, category: 'Rent', cycle: 'monthly', startDate: '2026-01-01T00:00:00.000Z', active: true },
      },
      expense('paid', 1, 900, 'Rent', 'rule-1'),
    ];
    const f = forecastMonth(events, '2026-06', now);
    expect(f.scheduled).toBe(0);
    expect(f.actual).toBe(900);
  });

  it('ignores paused rules', () => {
    const events: LedgerEvent[] = [
      {
        id: 'r',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'rule-1', kind: 'expense', label: 'Gym', amount: 40, category: 'Gym', cycle: 'monthly', startDate: '2026-01-01T00:00:00.000Z', active: false },
      },
    ];
    expect(forecastMonth(events, '2026-06', now).scheduled).toBe(0);
  });

  it('flags the pace as unreliable in the first days of a month', () => {
    expect(forecastMonth([expense('1', 1, 500)], '2026-06', new Date('2026-06-02T00:00:00.000Z')).reliable).toBe(false);
    expect(forecastMonth([expense('1', 1, 500)], '2026-06', now).reliable).toBe(true);
  });

  it('does not project anything for a month already over', () => {
    const f = forecastMonth([expense('1', 1, 100)], '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect({ projected: f.projected, daysRemaining: f.daysRemaining, total: f.total }).toEqual({ projected: 0, daysRemaining: 0, total: 100 });
  });
});

describe('savingsRateSeries', () => {
  it('reports the share of income kept', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Pay' },
      { id: '2', type: 'expense', timestamp: '2026-01-10T00:00:00.000Z', amount: 250, category: 'Food' },
    ];
    expect(savingsRateSeries(events)[0]).toMatchObject({ month: '2026-01', saved: 750, rate: 75 });
  });

  it('goes negative when more was spent than earned', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 100, label: 'Pay' },
      { id: '2', type: 'expense', timestamp: '2026-01-10T00:00:00.000Z', amount: 150, category: 'Food' },
    ];
    expect(savingsRateSeries(events)[0].rate).toBe(-50);
  });

  it('returns null rather than dividing by zero income', () => {
    const events: LedgerEvent[] = [{ id: '1', type: 'expense', timestamp: '2026-01-10T00:00:00.000Z', amount: 50, category: 'Food' }];
    expect(savingsRateSeries(events)[0].rate).toBeNull();
  });
});

describe('sameMonthLastYear', () => {
  it('steps back exactly one year', () => {
    expect(sameMonthLastYear('2026-01')).toBe('2025-01');
    expect(sameMonthLastYear('2026-12')).toBe('2025-12');
  });
});

describe('findAnomalies', () => {
  // Nine ordinary coffees, then one that is not.
  const base = Array.from({ length: 9 }, (_, i) => expense(`c${i}`, i + 1, 4 + (i % 3), 'Coffee'));

  it('flags a charge far above the category norm', () => {
    const events = [...base, expense('big', 20, 90, 'Coffee')];
    const found = findAnomalies(events, '2026-06');
    expect(found.map((a) => a.event.id)).toEqual(['big']);
  });

  it('leaves ordinary charges alone', () => {
    expect(findAnomalies(base, '2026-06')).toEqual([]);
  });

  it('stays silent until a category has enough history to judge', () => {
    const events = [expense('a', 1, 5, 'New'), expense('b', 2, 200, 'New')];
    expect(findAnomalies(events, '2026-06')).toEqual([]);
  });

  it('compares within a category, so a big rent is not flagged against small coffees', () => {
    const events = [...base, ...Array.from({ length: 6 }, (_, i) => expense(`r${i}`, i + 1, 900, 'Rent'))];
    expect(findAnomalies(events, '2026-06')).toEqual([]);
  });

  it('ignores recurring charges, whose size is fixed by a rule', () => {
    const events = [...base, expense('big', 20, 90, 'Coffee', 'rule-1')];
    expect(findAnomalies(events, '2026-06')).toEqual([]);
  });

  it('does not divide by zero when every charge in a category is identical', () => {
    const identical = Array.from({ length: 6 }, (_, i) => expense(`i${i}`, i + 1, 10, 'Flat'));
    expect(() => findAnomalies([...identical, expense('odd', 20, 40, 'Flat')], '2026-06')).not.toThrow();
    expect(findAnomalies([...identical, expense('odd', 20, 40, 'Flat')], '2026-06').map((a) => a.event.id)).toEqual(['odd']);
  });
});

describe('budgetStatuses', () => {
  const events = [expense('1', 1, 80, 'Food'), expense('2', 2, 30, 'Fun')];

  it('classifies ok, close and over', () => {
    const budgets = new Map([
      ['Food', 100], // 80%  -> close
      ['Fun', 100], // 30%  -> ok
      ['Gone', 10], // 0%   -> ok
    ]);
    const byCat = Object.fromEntries(budgetStatuses(events, budgets, '2026-06').map((s) => [s.category, s.state]));
    expect(byCat).toEqual({ Food: 'close', Fun: 'ok', Gone: 'ok' });
  });

  it('marks a category over its limit', () => {
    expect(budgetStatuses(events, new Map([['Food', 50]]), '2026-06')[0]).toMatchObject({ state: 'over', spent: 80, limit: 50 });
  });

  it('sorts the most-used limits first', () => {
    const budgets = new Map([
      ['Fun', 100],
      ['Food', 100],
    ]);
    expect(budgetStatuses(events, budgets, '2026-06').map((s) => s.category)).toEqual(['Food', 'Fun']);
  });
});

describe('categoryNovelty', () => {
  const midMonth = new Date('2026-06-20T00:00:00.000Z'); // 20 of 30 days elapsed

  describe('firstTime', () => {
    it('flags a category with no expense before this month', () => {
      const events = [expenseIn('a', '2026-06', 200, 'NewThing')];
      expect(categoryNovelty(events, '2026-06', midMonth).firstTime).toEqual([{ category: 'NewThing', amount: 200 }]);
    });

    it('leaves alone a category that has been spent in before', () => {
      const events = [expenseIn('a', '2026-03', 50, 'Coffee'), expenseIn('b', '2026-06', 30, 'Coffee')];
      expect(categoryNovelty(events, '2026-06', midMonth).firstTime).toEqual([]);
    });

    it('sorts several first-time categories by amount, largest first', () => {
      const events = [expenseIn('a', '2026-06', 80, 'SmallNew'), expenseIn('b', '2026-06', 200, 'BigNew')];
      expect(categoryNovelty(events, '2026-06', midMonth).firstTime.map((f) => f.category)).toEqual(['BigNew', 'SmallNew']);
    });
  });

  describe('wentQuiet', () => {
    const habitual: LedgerEvent[] = [
      expenseIn('r1', '2026-03', 100, 'Rent'),
      expenseIn('r2', '2026-04', 100, 'Rent'),
      expenseIn('r3', '2026-05', 100, 'Rent'),
    ];

    it('flags a category spent every month for three months running that is silent this month', () => {
      expect(categoryNovelty(habitual, '2026-06', midMonth).wentQuiet).toEqual([{ category: 'Rent', usualAmount: 100 }]);
    });

    it('says nothing once enough of the month has not yet passed to tell "not yet" from "not this time"', () => {
      const earlyMonth = new Date('2026-06-05T00:00:00.000Z');
      expect(categoryNovelty(habitual, '2026-06', earlyMonth).wentQuiet).toEqual([]);
    });

    it('does not flag a category that is still spending', () => {
      const events = [...habitual, expenseIn('r4', '2026-06', 100, 'Rent')];
      expect(categoryNovelty(events, '2026-06', midMonth).wentQuiet).toEqual([]);
    });

    it('does not call two-out-of-three months a habit', () => {
      const events = [expenseIn('g1', '2026-04', 40, 'Gym'), expenseIn('g2', '2026-05', 40, 'Gym')];
      expect(categoryNovelty(events, '2026-06', midMonth).wentQuiet).toEqual([]);
    });

    it('treats a past month as fully elapsed, regardless of what day it is now', () => {
      const events: LedgerEvent[] = [
        expenseIn('r1', '2026-02', 100, 'Rent'),
        expenseIn('r2', '2026-03', 100, 'Rent'),
        expenseIn('r3', '2026-04', 100, 'Rent'),
      ];
      expect(categoryNovelty(events, '2026-05', new Date('2026-07-01T00:00:00.000Z')).wentQuiet).toEqual([
        { category: 'Rent', usualAmount: 100 },
      ]);
    });
  });
});
