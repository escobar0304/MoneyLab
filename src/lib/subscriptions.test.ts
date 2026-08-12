import { describe, it, expect } from 'vitest';
import { detectSubscriptions, subscriptionTotal } from './subscriptions';
import type { LedgerEvent } from './types';

const NOW = new Date('2026-08-10T12:00:00.000Z');

let seq = 0;
const charge = (amount: number, date: string, note?: string, category = 'Subscriptions'): LedgerEvent => ({
  id: `x${seq++}`,
  type: 'expense',
  timestamp: `${date}T10:00:00.000Z`,
  amount,
  category,
  ...(note ? { note } : {}),
});

/** N monthly charges on the 5th, ending in the month before `NOW`. */
function monthly(amounts: number[], note: string, startMonth = 3): LedgerEvent[] {
  return amounts.map((amount, i) => charge(amount, `2026-${String(startMonth + i).padStart(2, '0')}-05`, note));
}

describe('detectSubscriptions', () => {
  it('finds a charge that repeats monthly at a steady amount', () => {
    const found = detectSubscriptions(monthly([9.99, 9.99, 9.99, 9.99], 'Netflix'), NOW);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ label: 'Netflix', cadence: 'monthly', normalAmount: 9.99, yearlyCost: 119.88 });
  });

  it('needs at least three charges — two is a coincidence', () => {
    expect(detectSubscriptions(monthly([9.99, 9.99], 'Netflix'), NOW)).toHaveLength(0);
  });

  it('ignores a category that repeats but never costs the same', () => {
    // Groceries land every month and are not a subscription.
    const events = [
      charge(41, '2026-03-05', undefined, 'Groceries'),
      charge(88, '2026-04-05', undefined, 'Groceries'),
      charge(17, '2026-05-05', undefined, 'Groceries'),
      charge(120, '2026-06-05', undefined, 'Groceries'),
    ];
    expect(detectSubscriptions(events, NOW)).toHaveLength(0);
  });

  it('ignores charges with no rhythm', () => {
    const events = [charge(10, '2026-01-05', 'Ad hoc'), charge(10, '2026-01-08', 'Ad hoc'), charge(10, '2026-06-20', 'Ad hoc')];
    expect(detectSubscriptions(events, NOW)).toHaveLength(0);
  });

  it('recognises a yearly charge', () => {
    const events = [
      charge(60, '2024-02-01', 'Domain'),
      charge(60, '2025-02-01', 'Domain'),
      charge(60, '2026-02-01', 'Domain'),
    ];
    const [found] = detectSubscriptions(events, NOW);
    expect(found).toMatchObject({ cadence: 'yearly', yearlyCost: 60 });
  });

  it('flags a price rise against the established amount', () => {
    // The whole point: both numbers are individually plausible, so nothing else
    // in the app would ever show this.
    const [found] = detectSubscriptions(monthly([9.99, 9.99, 9.99, 12.99], 'Netflix'), NOW);
    expect(found.drift).toEqual({ from: 9.99, to: 12.99, pct: 30 });
  });

  it('flags a price cut too', () => {
    const [found] = detectSubscriptions(monthly([20, 20, 20, 15], 'Gym'), NOW);
    expect(found.drift?.pct).toBeLessThan(0);
  });

  it('stays quiet about a rounding-sized change', () => {
    const [found] = detectSubscriptions(monthly([9.99, 9.99, 9.99, 10.0], 'Netflix'), NOW);
    expect(found.drift).toBeNull();
  });

  it('knows when a recurring rule already covers it', () => {
    const events: LedgerEvent[] = [
      ...monthly([900, 900, 900, 900], 'Rent'),
      {
        id: 'r1',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'rent', kind: 'expense', label: 'Rent', amount: 900, cycle: 'monthly', startDate: '2026-01-01', active: true, category: 'Rent' },
      },
    ];
    expect(detectSubscriptions(events, NOW)[0].ruled).toBe(true);
  });

  it('reports an undeclared one as unruled — the case worth surfacing', () => {
    expect(detectSubscriptions(monthly([9.99, 9.99, 9.99, 9.99], 'Netflix'), NOW)[0].ruled).toBe(false);
  });

  it('notices when an expected charge never arrived', () => {
    // Monthly until March, nothing since: cancelled, or not logged.
    const found = detectSubscriptions(monthly([9.99, 9.99, 9.99], 'Spotify', 1), NOW);
    expect(found[0].overdueDays).toBeGreaterThan(60);
  });

  it('says nothing about overdue while the next charge is not yet due', () => {
    const events = monthly([9.99, 9.99, 9.99, 9.99], 'Netflix', 5); // May–Aug
    expect(detectSubscriptions(events, NOW)[0].overdueDays).toBeNull();
  });

  it('separates two subscriptions billed in the same category', () => {
    const events = [...monthly([9.99, 9.99, 9.99, 9.99], 'Netflix'), ...monthly([5.99, 5.99, 5.99, 5.99], 'Spotify')];
    const found = detectSubscriptions(events, NOW);
    expect(found.map((f) => f.label).sort()).toEqual(['Netflix', 'Spotify']);
  });

  it('groups case and accent variants of the same note', () => {
    const events = [charge(9.99, '2026-03-05', 'Ginásio'), charge(9.99, '2026-04-05', 'ginasio'), charge(9.99, '2026-05-05', 'GINÁSIO')];
    expect(detectSubscriptions(events, NOW)).toHaveLength(1);
  });

  it('orders by what it costs a year, because that is the order to act in', () => {
    const events = [...monthly([5, 5, 5, 5], 'Cheap'), ...monthly([50, 50, 50, 50], 'Dear')];
    expect(detectSubscriptions(events, NOW).map((f) => f.label)).toEqual(['Dear', 'Cheap']);
  });

  it('totals the annual cost of everything found', () => {
    const events = [...monthly([10, 10, 10, 10], 'A'), ...monthly([20, 20, 20, 20], 'B')];
    expect(subscriptionTotal(detectSubscriptions(events, NOW))).toBe(360);
  });
});
