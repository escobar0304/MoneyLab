import { describe, it, expect } from 'vitest';
import {
  totalBalance,
  balanceSeries,
  spendByCategoryForMonth,
  totalIncomeForMonth,
  totalOutflowForMonth,
} from './derive';
import type { LedgerEvent } from './types';

describe('totalBalance', () => {
  it('credits income and debits expenses', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck' },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 250, category: 'Food' },
    ];
    expect(totalBalance(events)).toBe(750);
  });

  it('respects the asOf cutoff', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck' },
      { id: '2', type: 'expense', timestamp: '2026-02-05T00:00:00.000Z', amount: 250, category: 'Food' },
    ];
    expect(totalBalance(events, '2026-01-15T00:00:00.000Z')).toBe(1000); // Feb expense excluded
  });

  it('returns 0 for an empty ledger', () => {
    expect(totalBalance([])).toBe(0);
  });
});

describe('balanceSeries', () => {
  it('produces one point per active month, valued at that month-end running balance', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck' },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 100, category: 'Food' },
      { id: '3', type: 'income', timestamp: '2026-02-01T00:00:00.000Z', amount: 500, label: 'Paycheck' },
    ];
    const series = balanceSeries(events);
    expect(series.map((p) => p.value)).toEqual([900, 1400]);
  });
});

describe('totalIncomeForMonth / totalOutflowForMonth', () => {
  it('sums income and expense amounts separately per month', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'income', timestamp: '2026-01-01T00:00:00.000Z', amount: 1000, label: 'Paycheck' },
      { id: '2', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 45, category: 'Food' },
      { id: '3', type: 'income', timestamp: '2026-02-01T00:00:00.000Z', amount: 500, label: 'Side gig' },
    ];
    expect(totalIncomeForMonth(events, '2026-01')).toBe(1000);
    expect(totalOutflowForMonth(events, '2026-01')).toBe(45);
    expect(totalIncomeForMonth(events, '2026-02')).toBe(500);
    expect(totalOutflowForMonth(events, '2026-02')).toBe(0);
  });
});

describe('spendByCategoryForMonth', () => {
  it('totals expenses per category within the given month only', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'expense', timestamp: '2026-01-05T00:00:00.000Z', amount: 45, category: 'Food' },
      { id: '2', type: 'expense', timestamp: '2026-01-20T00:00:00.000Z', amount: 30, category: 'Food' },
      { id: '3', type: 'expense', timestamp: '2026-02-01T00:00:00.000Z', amount: 99, category: 'Food' },
    ];
    expect(spendByCategoryForMonth(events, '2026-01')).toEqual({ Food: 75 });
  });
});
