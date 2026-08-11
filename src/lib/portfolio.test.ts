import { describe, it, expect } from 'vitest';
import { foldHoldings } from './entities';
import { toBase, formatForeign, BASE_CURRENCY } from './currency';
import type { Holding, LedgerEvent } from './types';

// Portfolio valuation moved to investments.ts and is covered by
// investments.test.ts, where the trade log it now depends on also lives.

const h = (over: Partial<Holding>): Holding => ({ id: 'h', symbol: 'X', label: 'X', quantity: 1, avgCost: 100, ...over });

describe('foldHoldings', () => {
  it('applies the latest upsert and drops removals', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'holding_upsert', timestamp: '2026-01-01T00:00:00.000Z', holding: h({ id: 'a', label: 'A', quantity: 1 }) },
      { id: '2', type: 'holding_upsert', timestamp: '2026-02-01T00:00:00.000Z', holding: h({ id: 'b', label: 'B' }) },
      { id: '3', type: 'holding_upsert', timestamp: '2026-03-01T00:00:00.000Z', holding: h({ id: 'a', label: 'A', quantity: 5 }) },
      { id: '4', type: 'holding_remove', timestamp: '2026-03-02T00:00:00.000Z', holdingId: 'b' },
    ];
    const held = foldHoldings(events);
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ id: 'a', quantity: 5 });
  });
});

describe('currency conversion', () => {
  it('converts and rounds to cents so sums stay exact money', () => {
    expect(toBase(10, 0.923456)).toBe(9.23);
    expect(toBase(19.99, 1.1)).toBe(21.99);
  });

  it('formats a known currency and survives an unknown code', () => {
    expect(formatForeign(10, 'USD')).toContain('10');
    expect(formatForeign(10, 'NOTREAL')).toBe('10.00 NOTREAL');
  });

  it('treats the base currency as a rate of exactly 1', () => {
    expect(toBase(50, 1)).toBe(50);
    expect(BASE_CURRENCY).toBe('EUR');
  });
});
