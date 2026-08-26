import { describe, it, expect } from 'vitest';
import { projectRunway } from './runway';
import type { LedgerEvent } from '../core/types';

const NOW = new Date('2026-08-10T12:00:00.000Z');

let seq = 0;
const income = (amount: number, date: string): LedgerEvent => ({
  id: `i${seq++}`,
  type: 'income',
  timestamp: date,
  amount,
  label: 'Salary',
});
const expense = (amount: number, date: string, over: Partial<{ recurringId: string; category: string }> = {}): LedgerEvent => ({
  id: `x${seq++}`,
  type: 'expense',
  timestamp: date,
  amount,
  category: over.category ?? 'Groceries',
  ...(over.recurringId ? { recurringId: over.recurringId } : {}),
});
const rule = (id: string, kind: 'income' | 'expense', amount: number, startDate: string, active = true): LedgerEvent => ({
  id: `r${seq++}`,
  type: 'recurring_upsert',
  timestamp: startDate,
  rule: { id, kind, label: kind === 'income' ? 'Salary' : 'Rent', amount, cycle: 'monthly', startDate, active, ...(kind === 'expense' ? { category: 'Rent' } : {}) },
});

describe('projectRunway', () => {
  it('starts from the current balance and runs for the window asked for', () => {
    const r = projectRunway([income(1000, '2026-08-01T00:00:00.000Z')], { now: NOW, days: 30 });
    expect(r.startingBalance).toBe(1000);
    expect(r.days).toHaveLength(30);
    expect(r.days[0].date).toBe('2026-08-11');
  });

  it('drops scheduled charges on their own day, not smeared across the month', () => {
    // Rent on the 1st: the balance must step down on 1 September, not drift.
    const events = [income(1000, '2026-08-01T00:00:00.000Z'), rule('rent', 'expense', 300, '2026-01-01T00:00:00.000Z')];
    const r = projectRunway(events, { now: NOW, days: 40 });

    const before = r.days.find((d) => d.date === '2026-08-31');
    const on = r.days.find((d) => d.date === '2026-09-01');
    expect(before?.scheduled).toBe(1000);
    expect(on?.scheduled).toBe(700);
    expect(on?.items).toEqual([{ label: 'Rent', amount: 300, kind: 'expense' }]);
  });

  it('credits scheduled income the same way', () => {
    const events = [income(100, '2026-08-01T00:00:00.000Z'), rule('sal', 'income', 2000, '2026-01-25T00:00:00.000Z')];
    const r = projectRunway(events, { now: NOW, days: 40 });
    expect(r.days.find((d) => d.date === '2026-08-25')?.scheduled).toBe(2100);
  });

  it('does not re-post a month the rule already paid', () => {
    // The August rent is in the balance already; projecting it again would
    // charge it twice.
    const events = [
      income(1000, '2026-08-01T00:00:00.000Z'),
      rule('rent', 'expense', 300, '2026-01-20T00:00:00.000Z'),
      expense(300, '2026-08-20T00:00:00.000Z', { recurringId: 'rent', category: 'Rent' }),
    ];
    const r = projectRunway(events, { now: NOW, days: 50 });
    expect(r.days.find((d) => d.date === '2026-08-20')?.items).toEqual([]);
    expect(r.days.find((d) => d.date === '2026-09-20')?.items).toHaveLength(1);
  });

  it('ignores paused rules', () => {
    const events = [income(1000, '2026-08-01T00:00:00.000Z'), rule('rent', 'expense', 300, '2026-01-01T00:00:00.000Z', false)];
    const r = projectRunway(events, { now: NOW, days: 40 });
    expect(r.days.every((d) => d.items.length === 0)).toBe(true);
  });

  it('excludes recurring charges from the daily pace', () => {
    // Rent must not be smeared over thirty days as well as landing on its own —
    // that would charge it twice and make every projection far too grim.
    const withRule = [
      income(5000, '2026-06-01T00:00:00.000Z'),
      rule('rent', 'expense', 900, '2026-06-01T00:00:00.000Z'),
      expense(900, '2026-06-01T00:00:00.000Z', { recurringId: 'rent', category: 'Rent' }),
      expense(900, '2026-07-01T00:00:00.000Z', { recurringId: 'rent', category: 'Rent' }),
    ];
    expect(projectRunway(withRule, { now: NOW }).dailyPace).toBe(0);
  });

  it('measures the pace over the history that exists, not the nominal window', () => {
    // 20 spent per day for 10 days is a rate of 20, not 200/90.
    const events: LedgerEvent[] = [income(1000, '2026-07-01T00:00:00.000Z')];
    for (let d = 1; d <= 10; d++) {
      events.push(expense(20, `2026-08-${String(d).padStart(2, '0')}T00:00:00.000Z`));
    }
    const r = projectRunway(events, { now: NOW });
    expect(r.dailyPace).toBeCloseTo(20, 0);
  });

  it('is unreliable with only a few days of history', () => {
    const events = [income(1000, '2026-08-08T00:00:00.000Z'), expense(50, '2026-08-09T00:00:00.000Z')];
    expect(projectRunway(events, { now: NOW }).reliable).toBe(false);
  });

  it('finds the day the money runs out, and how long that is', () => {
    // 900 earned, 600 spent at 10 a day: 300 left, so about a month of runway.
    const events: LedgerEvent[] = [income(900, '2026-05-01T00:00:00.000Z')];
    for (let i = 0; i < 60; i++) {
      events.push(expense(10, new Date(NOW.getTime() - i * 86_400_000).toISOString()));
    }
    const r = projectRunway(events, { now: NOW, days: 90 });
    expect(r.startingBalance).toBe(300);
    expect(r.dailyPace).toBeCloseTo(10, 0);
    expect(r.shortfall).not.toBeNull();
    expect(r.daysOfRunway).toBeGreaterThan(25);
    expect(r.daysOfRunway).toBeLessThan(35);
  });

  it('reports no shortfall when the money lasts', () => {
    const r = projectRunway([income(100_000, '2026-08-01T00:00:00.000Z')], { now: NOW, days: 60 });
    expect(r.shortfall).toBeNull();
    expect(r.daysOfRunway).toBeNull();
  });

  it('always names a trough, even when it never goes negative', () => {
    // Rent on the 1st, salary on the 25th, and steady day-to-day spending in
    // between. The low point is the day before payday — precisely the number a
    // month-end total cannot show, because it nets the two out.
    const events: LedgerEvent[] = [
      income(3000, '2026-08-01T00:00:00.000Z'),
      rule('rent', 'expense', 900, '2026-01-01T00:00:00.000Z'),
      rule('sal', 'income', 1800, '2026-01-25T00:00:00.000Z'),
    ];
    for (let i = 0; i < 30; i++) events.push(expense(15, new Date(NOW.getTime() - i * 86_400_000).toISOString()));

    const r = projectRunway(events, { now: NOW, days: 60 });
    expect(r.dailyPace).toBe(15);
    expect(r.trough?.date).toBe('2026-08-24');
    expect(r.trough?.expected).toBe(Math.min(...r.days.map((d) => d.expected)));
  });

  it('keeps the scheduled line above the expected one when anything is being spent', () => {
    const events: LedgerEvent[] = [income(5000, '2026-05-01T00:00:00.000Z')];
    for (let i = 0; i < 30; i++) events.push(expense(15, new Date(NOW.getTime() - i * 86_400_000).toISOString()));
    const r = projectRunway(events, { now: NOW, days: 30 });
    const last = r.days[r.days.length - 1];
    expect(last.scheduled).toBeGreaterThan(last.expected);
  });
});
