import { describe, it, expect } from 'vitest';
import { portfolioSummary } from './analysis';
import { foldHoldings } from './entities';
import { toBase, formatForeign, BASE_CURRENCY } from './currency';
import type { Holding, LedgerEvent } from './types';

const h = (over: Partial<Holding>): Holding => ({ id: 'h', symbol: 'X', label: 'X', quantity: 1, avgCost: 100, ...over });

describe('portfolioSummary', () => {
  it('values a priced holding at the market price', () => {
    expect(portfolioSummary([h({ quantity: 2, avgCost: 100, lastPrice: 150 })])).toMatchObject({ cost: 200, value: 300, gain: 100, gainPct: 50 });
  });

  it('falls back to cost for an unpriced holding rather than counting it as zero', () => {
    const s = portfolioSummary([h({ quantity: 2, avgCost: 100 })]);
    expect({ cost: s.cost, value: s.value, gain: s.gain, unpriced: s.unpriced }).toEqual({ cost: 200, value: 200, gain: 0, unpriced: 1 });
  });

  it('reports a loss without flipping the sign', () => {
    expect(portfolioSummary([h({ quantity: 1, avgCost: 100, lastPrice: 60 })])).toMatchObject({ gain: -40, gainPct: -40 });
  });

  it('surfaces the oldest price so a stale valuation can be qualified', () => {
    const s = portfolioSummary([
      h({ id: 'a', quantity: 1, avgCost: 10, lastPrice: 12, lastPriceAt: '2026-08-01T00:00:00.000Z' }),
      h({ id: 'b', quantity: 1, avgCost: 10, lastPrice: 9, lastPriceAt: '2026-06-01T00:00:00.000Z' }),
    ]);
    expect(s.stalestPriceAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('has no gain percentage when nothing was bought', () => {
    expect(portfolioSummary([]).gainPct).toBeNull();
  });
});

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
