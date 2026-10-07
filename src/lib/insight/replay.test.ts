import { describe, it, expect } from 'vitest';
import { buildReplay } from './replay';
import type { LedgerEvent } from '../core/types';

function income(amount: number, date: string): LedgerEvent {
  return { id: `i-${date}`, type: 'income', timestamp: date, amount, label: 'Salary' };
}

function expense(amount: number, date: string, category = 'Shopping'): LedgerEvent {
  return { id: `e-${date}-${category}`, type: 'expense', timestamp: date, amount, category };
}

describe('buildReplay', () => {
  it('produces one point per day for a month, running the balance forward', () => {
    const events: LedgerEvent[] = [
      income(1000, '2026-08-01T00:00:00.000Z'),
      expense(100, '2026-08-01T00:00:00.000Z'),
      expense(50, '2026-08-02T00:00:00.000Z'),
    ];
    const points = buildReplay(events, 'month', '2026-08', new Date('2026-08-31T23:59:59.999Z'));
    expect(points).toHaveLength(31);
    expect(points[0]).toMatchObject({ label: '1', income: 1000, spend: 100, balance: 900 });
    expect(points[1]).toMatchObject({ label: '2', income: 0, spend: 50, balance: 850 });
    expect(points[2]).toMatchObject({ label: '3', income: 0, spend: 0, balance: 850 });
  });

  it('stops at now instead of running through a future day', () => {
    const points = buildReplay([], 'month', '2026-08', new Date('2026-08-05T12:00:00.000Z'));
    expect(points).toHaveLength(5);
    expect(points[points.length - 1].label).toBe('5');
  });

  // Today used to be dropped entirely, because its end-of-day cutoff is in the
  // future. That hid exactly what the reader had just logged, and left the
  // replay ending on a different total from the recap beside it.
  it('includes today, valued as of now — this morning in, this evening out', () => {
    const now = new Date('2026-08-05T12:00:00.000Z');
    const events: LedgerEvent[] = [
      income(1000, '2026-08-01T09:00:00.000Z'),
      expense(40, '2026-08-05T08:00:00.000Z', 'Breakfast'),
      expense(300, '2026-08-05T20:00:00.000Z', 'Dinner'),
    ];
    const today = buildReplay(events, 'month', '2026-08', now).at(-1)!;
    expect(today).toMatchObject({ label: '5', spend: 40, balance: 960, date: now.toISOString() });
    expect(today.topExpense).toEqual({ category: 'Breakfast', amount: 40 });
  });

  it('includes the month in progress in a year, its balance as of now', () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    const events: LedgerEvent[] = [income(1000, '2026-01-15T00:00:00.000Z'), expense(200, '2026-03-02T00:00:00.000Z')];
    const points = buildReplay(events, 'year', '2026', now);
    expect(points.map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(points[2]).toMatchObject({ balance: 800, date: now.toISOString() });
  });

  it('produces one point per month for a year, labeled by month name', () => {
    const events: LedgerEvent[] = [income(1000, '2026-01-15T00:00:00.000Z'), expense(200, '2026-02-15T00:00:00.000Z')];
    // The last instant of February: March has not begun, so it has no point.
    const points = buildReplay(events, 'year', '2026', new Date('2026-02-28T23:59:59.999Z'));
    expect(points.map((p) => p.label)).toEqual(['Jan', 'Feb']);
    expect(points[0]).toMatchObject({ income: 1000, spend: 0, balance: 1000 });
    expect(points[1]).toMatchObject({ income: 0, spend: 200, balance: 800 });
  });

  it('picks out the single biggest expense of each point', () => {
    const events: LedgerEvent[] = [expense(10, '2026-08-01T00:00:00.000Z', 'Coffee'), expense(80, '2026-08-01T00:00:00.000Z', 'Groceries')];
    const points = buildReplay(events, 'month', '2026-08', new Date('2026-08-01T23:59:59.999Z'));
    expect(points[0].topExpense).toEqual({ category: 'Groceries', amount: 80 });
  });

  it('is empty for a period entirely in the future', () => {
    expect(buildReplay([], 'month', '2026-12', new Date('2026-01-01T00:00:00.000Z'))).toEqual([]);
  });
});
