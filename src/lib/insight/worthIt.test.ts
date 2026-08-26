import { describe, it, expect } from 'vitest';
import { pendingWorthItChecks, worthItStatsForMonths, WORTH_IT_DELAY_DAYS } from './worthIt';
import type { LedgerEvent } from '../core/types';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function expense(over: Partial<Extract<LedgerEvent, { type: 'expense' }>> = {}): LedgerEvent {
  return {
    id: over.id ?? 'e1',
    type: 'expense',
    timestamp: '2026-08-01T00:00:00.000Z',
    amount: 100,
    category: 'Shopping',
    ...over,
  };
}

describe('pendingWorthItChecks', () => {
  it('flags a big enough, old enough expense with no verdict yet', () => {
    const pending = pendingWorthItChecks([expense()], 50, NOW);
    expect(pending).toHaveLength(1);
    expect(pending[0].entry.id).toBe('e1');
  });

  it('ignores anything under the threshold', () => {
    expect(pendingWorthItChecks([expense({ amount: 40 })], 50, NOW)).toEqual([]);
  });

  it(`waits ${WORTH_IT_DELAY_DAYS} days before asking`, () => {
    const recent = expense({ timestamp: new Date(NOW.getTime() - 2 * 86400000).toISOString() });
    expect(pendingWorthItChecks([recent], 50, NOW)).toEqual([]);
  });

  it('never asks about a recurring-generated expense', () => {
    expect(pendingWorthItChecks([expense({ recurringId: 'r1' })], 50, NOW)).toEqual([]);
  });

  it('only asks about a split purchase once, on its first instalment', () => {
    const first = expense({ id: 'a', splitId: 's1', splitIndex: 1, splitCount: 3 });
    const second = expense({ id: 'b', splitId: 's1', splitIndex: 2, splitCount: 3 });
    const pending = pendingWorthItChecks([first, second], 50, NOW);
    expect(pending.map((p) => p.entry.id)).toEqual(['a']);
  });

  it('drops an expense once a verdict is recorded', () => {
    const events: LedgerEvent[] = [
      expense(),
      { id: 'v1', type: 'worth_it', timestamp: '2026-08-10T00:00:00.000Z', entryId: 'e1', worthIt: true },
    ];
    expect(pendingWorthItChecks(events, 50, NOW)).toEqual([]);
  });

  it('sorts oldest first', () => {
    const older = expense({ id: 'older', timestamp: '2026-07-01T00:00:00.000Z' });
    const newer = expense({ id: 'newer', timestamp: '2026-08-01T00:00:00.000Z' });
    const pending = pendingWorthItChecks([newer, older], 50, NOW);
    expect(pending.map((p) => p.entry.id)).toEqual(['older', 'newer']);
  });
});

describe('worthItStatsForMonths', () => {
  it('counts only answered expenses within the given months', () => {
    const events: LedgerEvent[] = [
      expense({ id: 'a', timestamp: '2026-08-01T00:00:00.000Z' }),
      { id: 'v1', type: 'worth_it', timestamp: '2026-08-10T00:00:00.000Z', entryId: 'a', worthIt: true },
      expense({ id: 'b', timestamp: '2026-08-05T00:00:00.000Z' }),
      { id: 'v2', type: 'worth_it', timestamp: '2026-08-12T00:00:00.000Z', entryId: 'b', worthIt: false },
      expense({ id: 'c', timestamp: '2026-07-01T00:00:00.000Z' }),
      { id: 'v3', type: 'worth_it', timestamp: '2026-07-12T00:00:00.000Z', entryId: 'c', worthIt: true },
    ];
    expect(worthItStatsForMonths(events, new Set(['2026-08']))).toEqual({ answered: 2, yes: 1 });
  });

  it('ignores an expense with no verdict yet', () => {
    expect(worthItStatsForMonths([expense()], new Set(['2026-08']))).toEqual({ answered: 0, yes: 0 });
  });
});
