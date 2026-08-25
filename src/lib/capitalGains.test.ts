import { describe, it, expect } from 'vitest';
import { closedLots, capitalGainsByYear, capitalGainsToCsv } from './capitalGains';
import type { LedgerEvent } from './types';

let seq = 0;
const holding = (id: string, symbol: string, label: string): LedgerEvent => ({
  id: `h${seq++}`,
  type: 'holding_upsert',
  timestamp: '2025-01-01T00:00:00.000Z',
  holding: { id, symbol, label, quantity: 0, avgCost: 0 },
});
const buy = (holdingId: string, quantity: number, price: number, date: string, fees?: number): LedgerEvent => ({
  id: `t${seq++}`,
  type: 'trade',
  timestamp: date,
  holdingId,
  side: 'buy',
  quantity,
  price,
  fees,
});
const sell = (holdingId: string, quantity: number, price: number, date: string, fees?: number): LedgerEvent => ({
  id: `t${seq++}`,
  type: 'trade',
  timestamp: date,
  holdingId,
  side: 'sell',
  quantity,
  price,
  fees,
});

describe('closedLots', () => {
  it('matches a sale against the single lot it came from', () => {
    const events = [
      holding('h1', 'AAPL', 'Apple'),
      buy('h1', 10, 100, '2025-01-10T00:00:00.000Z'),
      sell('h1', 10, 150, '2026-02-10T00:00:00.000Z'),
    ];
    expect(closedLots(events)).toEqual([
      expect.objectContaining({ quantity: 10, costBasis: 1000, proceeds: 1500, gain: 500, holdingDays: 396 }),
    ]);
  });

  it('matches oldest lot first (FIFO), splitting a sale across two lots', () => {
    const events = [
      holding('h1', 'AAPL', 'Apple'),
      buy('h1', 5, 100, '2025-01-01T00:00:00.000Z'), // lot A
      buy('h1', 5, 120, '2025-06-01T00:00:00.000Z'), // lot B
      sell('h1', 8, 150, '2025-07-01T00:00:00.000Z'), // takes all of A, 3 of B
    ];
    const lots = closedLots(events);
    expect(lots).toHaveLength(2);
    expect(lots[0]).toMatchObject({ quantity: 5, costBasis: 500 }); // all of lot A
    expect(lots[1]).toMatchObject({ quantity: 3, costBasis: 360 }); // 3 units of lot B at 120
  });

  it('leaves a lot open, and the queue in order, across more than one sale', () => {
    const events = [
      holding('h1', 'AAPL', 'Apple'),
      buy('h1', 10, 100, '2025-01-01T00:00:00.000Z'),
      sell('h1', 4, 150, '2025-06-01T00:00:00.000Z'),
      sell('h1', 3, 160, '2025-09-01T00:00:00.000Z'),
    ];
    const lots = closedLots(events);
    expect(lots.map((l) => l.quantity)).toEqual([4, 3]);
    // Both sales draw from the same original lot, so both report the same
    // acquisition date.
    expect(lots.every((l) => l.acquiredAt === '2025-01-01T00:00:00.000Z')).toBe(true);
  });

  it('adds buy fees to cost basis and deducts sell fees from proceeds', () => {
    const events = [
      holding('h1', 'AAPL', 'Apple'),
      buy('h1', 10, 100, '2025-01-01T00:00:00.000Z', 10), // cost basis 1010
      sell('h1', 10, 150, '2025-06-01T00:00:00.000Z', 15), // proceeds 1500 - 15
    ];
    expect(closedLots(events)[0]).toMatchObject({ costBasis: 1010, proceeds: 1485, gain: 475 });
  });

  it('keeps separate holdings from matching against each other', () => {
    const events = [
      holding('h1', 'AAPL', 'Apple'),
      holding('h2', 'MSFT', 'Microsoft'),
      buy('h1', 5, 100, '2025-01-01T00:00:00.000Z'),
      buy('h2', 5, 200, '2025-01-01T00:00:00.000Z'),
      sell('h2', 5, 250, '2025-06-01T00:00:00.000Z'),
    ];
    const lots = closedLots(events);
    expect(lots).toHaveLength(1);
    expect(lots[0].symbol).toBe('MSFT');
  });

  it('still names a lot after the holding it belonged to has been removed', () => {
    const events: LedgerEvent[] = [
      holding('h1', 'AAPL', 'Apple'),
      buy('h1', 5, 100, '2025-01-01T00:00:00.000Z'),
      sell('h1', 5, 150, '2025-06-01T00:00:00.000Z'),
      { id: 'r1', type: 'holding_remove', timestamp: '2025-07-01T00:00:00.000Z', holdingId: 'h1' },
    ];
    expect(closedLots(events)[0]).toMatchObject({ symbol: 'AAPL', label: 'Apple' });
  });
});

describe('capitalGainsByYear', () => {
  const events = [
    holding('h1', 'AAPL', 'Apple'),
    buy('h1', 10, 100, '2024-01-01T00:00:00.000Z'),
    sell('h1', 4, 150, '2025-03-01T00:00:00.000Z'), // gain 200, in 2025
    sell('h1', 6, 80, '2026-01-01T00:00:00.000Z'), // loss 120, in 2026
  ];

  it('only counts lots disposed of within the year asked for', () => {
    const y2025 = capitalGainsByYear(events, 2025);
    expect(y2025.lots).toHaveLength(1);
    expect(y2025.netGain).toBe(200);
  });

  it('separates gains and losses rather than only netting them', () => {
    const combined: LedgerEvent[] = [
      holding('h2', 'BTC', 'Bitcoin'),
      buy('h2', 1, 10_000, '2024-01-01T00:00:00.000Z'),
      sell('h2', 1, 8000, '2025-01-01T00:00:00.000Z'), // loss 2000
      holding('h3', 'ETH', 'Ether'),
      buy('h3', 1, 1000, '2024-01-01T00:00:00.000Z'),
      sell('h3', 1, 1500, '2025-02-01T00:00:00.000Z'), // gain 500
    ];
    const y2025 = capitalGainsByYear(combined, 2025);
    expect(y2025).toMatchObject({ gain: 500, loss: 2000, netGain: -1500 });
  });

  it('is empty for a year nothing was sold in', () => {
    expect(capitalGainsByYear(events, 2030)).toMatchObject({ lots: [], netGain: 0 });
  });
});

describe('capitalGainsToCsv', () => {
  it('lists every lot, then the totals', () => {
    const events = [holding('h1', 'AAPL', 'Apple'), buy('h1', 10, 100, '2024-01-01T00:00:00.000Z'), sell('h1', 10, 150, '2025-03-01T00:00:00.000Z')];
    const csv = capitalGainsToCsv(capitalGainsByYear(events, 2025));
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Capital gains 2025');
    expect(lines[2]).toBe('Symbol,Label,Quantity,Acquired,Disposed,Days held,Cost basis,Proceeds,Gain/loss');
    expect(lines[3]).toBe('AAPL,Apple,10,2024-01-01,2025-03-01,425,1000.00,1500.00,500.00');
    expect(lines.at(-1)).toBe('Net gain/loss,500.00');
  });
});
