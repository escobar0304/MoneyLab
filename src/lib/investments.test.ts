import { describe, it, expect } from 'vitest';
import { applyTrades, positionFor, investmentSummary, xirr, cashflowsFor } from './investments';
import type { Holding, TradeEvent, DividendEvent } from './types';

const holding = (over: Partial<Holding> = {}): Holding => ({
  id: 'h1',
  symbol: 'XETR:VWCE',
  label: 'VWCE',
  quantity: 0,
  avgCost: 0,
  ...over,
});

let seq = 0;
const buy = (quantity: number, price: number, date: string, fees?: number): TradeEvent => ({
  id: `t${seq++}`,
  type: 'trade',
  timestamp: date,
  holdingId: 'h1',
  side: 'buy',
  quantity,
  price,
  ...(fees ? { fees } : {}),
});
const sell = (quantity: number, price: number, date: string, fees?: number): TradeEvent => ({
  ...buy(quantity, price, date, fees),
  side: 'sell',
});
const dividend = (amount: number, date: string): DividendEvent => ({
  id: `d${seq++}`,
  type: 'dividend',
  timestamp: date,
  holdingId: 'h1',
  amount,
});

describe('applyTrades', () => {
  it('averages the cost of two purchases at different prices', () => {
    const basis = applyTrades([buy(10, 100, '2025-01-01T00:00:00.000Z'), buy(10, 120, '2025-06-01T00:00:00.000Z')]);
    expect(basis.quantity).toBe(20);
    expect(basis.cost).toBe(2200);
    expect(basis.avgCost).toBe(110);
  });

  it('adds fees to the basis on a buy', () => {
    const basis = applyTrades([buy(10, 100, '2025-01-01T00:00:00.000Z', 5)]);
    expect(basis.cost).toBe(1005);
  });

  it('books a realised gain on a sell, net of fees', () => {
    // 10 @ 100, sell 4 @ 150 with 3 in fees: proceeds 600 − 3 − basis 400 = 197.
    const basis = applyTrades([buy(10, 100, '2025-01-01T00:00:00.000Z'), sell(4, 150, '2025-07-01T00:00:00.000Z', 3)]);
    expect(basis.realized).toBe(197);
    expect(basis.quantity).toBe(6);
    expect(basis.cost).toBe(600);
  });

  it('leaves the average cost unchanged by a sale', () => {
    // Selling realises a gain; it must not re-price what is still held.
    const basis = applyTrades([buy(10, 100, '2025-01-01T00:00:00.000Z'), sell(5, 500, '2025-07-01T00:00:00.000Z')]);
    expect(basis.avgCost).toBe(100);
  });

  it('clamps a sale of more than is held instead of going negative', () => {
    const basis = applyTrades([buy(5, 100, '2025-01-01T00:00:00.000Z'), sell(50, 120, '2025-07-01T00:00:00.000Z')]);
    expect(basis.quantity).toBe(0);
    expect(basis.cost).toBe(0);
    expect(basis.realized).toBe(100); // 5 × (120 − 100)
  });

  it('lands exactly on zero after selling everything', () => {
    // Float residue here would render as "0.0000001 units worth €0.00".
    const basis = applyTrades([buy(0.3, 100, '2025-01-01T00:00:00.000Z'), sell(0.1, 100, '2025-02-01T00:00:00.000Z'), sell(0.2, 100, '2025-03-01T00:00:00.000Z')]);
    expect(basis.quantity).toBe(0);
    expect(basis.cost).toBe(0);
  });
});

describe('positionFor', () => {
  it('uses the holding record when there are no trades', () => {
    const p = positionFor(holding({ quantity: 3, avgCost: 50, lastPrice: 80 }), [], []);
    expect({ quantity: p.quantity, cost: p.cost, value: p.value, unrealized: p.unrealized }).toEqual({
      quantity: 3,
      cost: 150,
      value: 240,
      unrealized: 90,
    });
  });

  it('lets the trade log override a stale record', () => {
    const p = positionFor(holding({ quantity: 999, avgCost: 1 }), [buy(2, 100, '2025-01-01T00:00:00.000Z')], []);
    expect(p.quantity).toBe(2);
    expect(p.cost).toBe(200);
  });

  it('falls back to cost for an unpriced holding rather than counting it as zero', () => {
    const p = positionFor(holding({ quantity: 2, avgCost: 100 }), [], []);
    expect({ value: p.value, unrealized: p.unrealized, priced: p.priced }).toEqual({ value: 200, unrealized: 0, priced: false });
  });

  it('reports a loss without flipping the sign', () => {
    const p = positionFor(holding({ quantity: 1, avgCost: 100, lastPrice: 60 }), [], []);
    expect(p.unrealized).toBe(-40);
  });

  it('adds dividends to total return without touching cost or value', () => {
    const p = positionFor(holding({ quantity: 10, avgCost: 100, lastPrice: 110 }), [], [dividend(30, '2025-06-01T00:00:00.000Z')]);
    expect({ cost: p.cost, value: p.value, dividends: p.dividends, totalReturn: p.totalReturn }).toEqual({
      cost: 1000,
      value: 1100,
      dividends: 30,
      totalReturn: 130,
    });
  });

  it('only counts trades and dividends belonging to this holding', () => {
    const other: TradeEvent = { ...buy(100, 999, '2025-01-01T00:00:00.000Z'), holdingId: 'other' };
    const p = positionFor(holding({ quantity: 1, avgCost: 10 }), [other], []);
    expect(p.quantity).toBe(1);
  });
});

describe('xirr', () => {
  it('recovers a known annual rate from a single-year holding', () => {
    const rate = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 1100 },
    ]);
    expect(rate).toBeCloseTo(0.1, 2);
  });

  it('weights a late contribution properly', () => {
    // Same total in and out as above, but half the money arrived in month 11 —
    // a naive gain percentage cannot tell these apart; XIRR must.
    const late = xirr([
      { date: new Date('2025-01-01'), amount: -500 },
      { date: new Date('2025-12-01'), amount: -500 },
      { date: new Date('2026-01-01'), amount: 1100 },
    ]);
    expect(late).not.toBeNull();
    expect(late as number).toBeGreaterThan(0.1);
  });

  it('handles a loss without blowing up', () => {
    const rate = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 500 },
    ]);
    expect(rate).toBeCloseTo(-0.5, 2);
  });

  it('has no answer when every flow points the same way', () => {
    expect(
      xirr([
        { date: new Date('2025-01-01'), amount: -100 },
        { date: new Date('2026-01-01'), amount: -100 },
      ])
    ).toBeNull();
  });

  it('has no answer when everything happened on one day', () => {
    expect(
      xirr([
        { date: new Date('2025-01-01'), amount: -100 },
        { date: new Date('2025-01-01'), amount: 120 },
      ])
    ).toBeNull();
  });

  it('has no answer from a single flow', () => {
    expect(xirr([{ date: new Date('2025-01-01'), amount: -100 }])).toBeNull();
  });
});

describe('cashflowsFor', () => {
  it('signs buys negative and sells positive, and ends with the current value', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const flows = cashflowsFor([buy(1, 100, '2025-01-01T00:00:00.000Z', 2), sell(1, 150, '2025-06-01T00:00:00.000Z', 3)], [dividend(5, '2025-03-01T00:00:00.000Z')], 0, now);
    expect(flows.map((f) => f.amount)).toEqual([-102, 5, 147]);
  });

  it('omits a zero terminal value rather than adding a meaningless flow', () => {
    const flows = cashflowsFor([buy(1, 100, '2025-01-01T00:00:00.000Z')], [], 0, new Date('2026-01-01'));
    expect(flows).toHaveLength(1);
  });
});

describe('investmentSummary', () => {
  it('adds up cost, value and return across positions', () => {
    const positions = [
      positionFor(holding({ id: 'a', quantity: 2, avgCost: 100, lastPrice: 150 }), [], []),
      positionFor(holding({ id: 'b', quantity: 1, avgCost: 100, lastPrice: 60 }), [], []),
    ];
    const s = investmentSummary(positions, [], []);
    expect({ cost: s.cost, value: s.value, unrealized: s.unrealized }).toEqual({ cost: 300, value: 360, unrealized: 60 });
  });

  it('counts unpriced holdings and surfaces the oldest price', () => {
    const positions = [
      positionFor(holding({ id: 'a', quantity: 1, avgCost: 10, lastPrice: 12, lastPriceAt: '2026-08-01T00:00:00.000Z' }), [], []),
      positionFor(holding({ id: 'b', quantity: 1, avgCost: 10, lastPrice: 9, lastPriceAt: '2026-06-01T00:00:00.000Z' }), [], []),
      positionFor(holding({ id: 'c', quantity: 1, avgCost: 10 }), [], []),
    ];
    const s = investmentSummary(positions, [], []);
    expect(s.unpriced).toBe(1);
    expect(s.stalestPriceAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('has no return percentage when nothing was bought', () => {
    expect(investmentSummary([], [], []).returnPct).toBeNull();
  });
});
