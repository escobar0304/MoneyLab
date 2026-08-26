import { describe, it, expect } from 'vitest';
import { buildPeriodReview, currentPeriod, shiftPeriod } from './review';
import type { LedgerEvent } from '../core/types';

const income = (id: string, month: string, amount: number, day = '01'): LedgerEvent => ({
  id,
  type: 'income',
  timestamp: `${month}-${day}T00:00:00.000Z`,
  amount,
  label: 'Salary',
});

const expense = (id: string, month: string, amount: number, category = 'Food', day = '10'): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp: `${month}-${day}T00:00:00.000Z`,
  amount,
  category,
});

describe('buildPeriodReview — month', () => {
  it('totals income, spend and the savings rate for that month alone', () => {
    const events = [
      income('i1', '2026-06', 2000),
      expense('e1', '2026-06', 500, 'Rent'),
      expense('e2', '2026-06', 300, 'Food'),
      // Outside the period — must not leak in.
      income('i2', '2026-07', 2000),
      expense('e3', '2026-07', 900, 'Rent'),
    ];
    const r = buildPeriodReview(events, 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect(r.income).toBe(2000);
    expect(r.spend).toBe(800);
    expect(r.saved).toBe(1200);
    expect(r.savingsRatePct).toBeCloseTo(60, 5);
    expect(r.months).toEqual(['2026-06']);
  });

  it('is null on the rate when there was no income to divide by', () => {
    const events = [expense('e1', '2026-06', 100)];
    const r = buildPeriodReview(events, 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect(r.savingsRatePct).toBeNull();
  });

  it('ranks categories by spend and gives each a share of the total', () => {
    const events = [expense('e1', '2026-06', 600, 'Rent'), expense('e2', '2026-06', 300, 'Food'), expense('e3', '2026-06', 100, 'Fun')];
    const r = buildPeriodReview(events, 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect(r.topCategories.map((c) => c.category)).toEqual(['Rent', 'Food', 'Fun']);
    expect(r.topCategories[0].share).toBe(60); // 600 / 1000
  });

  it('measures net worth change against the balance at the end of the month before', () => {
    const events = [income('i1', '2026-06', 2000), expense('e1', '2026-06', 1200, 'Rent')];
    const r = buildPeriodReview(events, 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    // No prior events, so the "before" balance is zero and the change is
    // exactly what was saved this month.
    expect(r.netWorthChange).toBe(800);
  });

  it('does not fold the previous month’s activity into this one’s change', () => {
    const events = [
      income('i0', '2026-05', 2000),
      expense('e0', '2026-05', 100, 'Rent'), // May moves the balance by +1900
      income('i1', '2026-06', 2000),
      expense('e1', '2026-06', 1200, 'Rent'), // June moves it by +800
    ];
    const r = buildPeriodReview(events, 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect(r.netWorthChange).toBe(800);
  });

  it('does not compute a best/worst month for a single month', () => {
    const r = buildPeriodReview([income('i1', '2026-06', 1000)], 'month', '2026-06', new Date('2026-08-01T00:00:00.000Z'));
    expect(r.bestMonth).toBeNull();
    expect(r.worstMonth).toBeNull();
  });
});

describe('buildPeriodReview — year', () => {
  const yearEvents: LedgerEvent[] = [
    income('i1', '2026-01', 2000),
    expense('e1', '2026-01', 1800, 'Rent'), // a lean month
    income('i2', '2026-06', 2000),
    expense('e2', '2026-06', 500, 'Rent'), // the best month
    // A December in 2025 must not leak into a 2026 review.
    income('i3', '2025-12', 5000),
  ];

  it('sums all twelve months, not just the ones with activity', () => {
    const r = buildPeriodReview(yearEvents, 'year', '2026', new Date('2027-01-01T00:00:00.000Z'));
    expect(r.months).toHaveLength(12);
    expect(r.months[0]).toBe('2026-01');
    expect(r.months[11]).toBe('2026-12');
    expect(r.income).toBe(4000);
    expect(r.spend).toBe(2300);
  });

  it('picks the best and worst month by amount saved', () => {
    const r = buildPeriodReview(yearEvents, 'year', '2026', new Date('2027-01-01T00:00:00.000Z'));
    expect(r.bestMonth?.month).toBe('2026-06');
    expect(r.worstMonth?.month).toBe('2026-01');
  });
});

describe('buildPeriodReview — subscriptions', () => {
  it('counts only what changed price or was never declared', () => {
    const netflix: LedgerEvent[] = [9.99, 9.99, 9.99, 12.99].map((amount, i) => ({
      id: `nf-${i}`,
      type: 'expense',
      timestamp: `2026-0${i + 3}-05T00:00:00.000Z`,
      amount,
      category: 'Subscriptions',
      note: 'Netflix',
    }));
    const r = buildPeriodReview([income('i1', '2026-06', 2000), ...netflix], 'year', '2026', new Date('2026-07-01T00:00:00.000Z'));
    expect(r.subscriptions.count).toBe(1);
    expect(r.subscriptions.undeclared).toBe(1);
    expect(r.subscriptions.drifted).toBe(1);
  });
});

describe('currentPeriod / shiftPeriod', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('reads the current month or year from the clock', () => {
    expect(currentPeriod('month', now)).toBe('2026-06');
    expect(currentPeriod('year', now)).toBe('2026');
  });

  it('steps a month or year forward and back', () => {
    expect(shiftPeriod('month', '2026-06', -1)).toBe('2026-05');
    expect(shiftPeriod('month', '2026-01', -1)).toBe('2025-12'); // crosses a year boundary
    expect(shiftPeriod('month', '2026-06', 1)).toBe('2026-07');
    expect(shiftPeriod('year', '2026', -1)).toBe('2025');
    expect(shiftPeriod('year', '2026', 1)).toBe('2027');
  });
});
