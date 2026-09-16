import { describe, it, expect } from 'vitest';
import { validateImport } from './importValidation';

const income = { id: 'a', type: 'income', timestamp: '2026-01-01T10:00:00.000Z', amount: 100, label: 'Pay' };
const expense = { id: 'b', type: 'expense', timestamp: '2026-01-02T10:00:00.000Z', amount: 4, category: 'Food' };

describe('validateImport', () => {
  it('accepts a real export', () => {
    expect(validateImport([income, expense])).toEqual({ ok: true, events: [income, expense] });
  });

  it('accepts an empty ledger', () => {
    expect(validateImport([])).toEqual({ ok: true, events: [] });
  });

  // v0 and v1 shapes still have to import — migrations move them forward, and
  // refusing them would strand the oldest backups, the ones most worth having.
  it('accepts legacy event types that migrations still handle', () => {
    const legacy = { id: 'c', type: 'salary_upsert', timestamp: '2024-01-01T10:00:00.000Z', salary: { id: 's', amount: 1 } };
    expect(validateImport([legacy]).ok).toBe(true);
  });

  it('rejects anything that is not a list', () => {
    for (const value of [null, undefined, 42, 'ledger', { events: [] }]) {
      expect(validateImport(value).ok).toBe(false);
    }
  });

  it('rejects an unknown event type', () => {
    const result = validateImport([{ id: 'x', type: 'drop_tables', timestamp: '2026-01-01T10:00:00.000Z' }]);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('unknown type') });
  });

  it('rejects an unreadable timestamp', () => {
    const result = validateImport([{ ...income, timestamp: 'last thursday' }]);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('timestamp') });
  });

  // An amount that is a string, NaN or Infinity poisons every total derived
  // from it, and does so without anything looking wrong on screen.
  it.each([['12.50'], [Number.NaN], [Number.POSITIVE_INFINITY], [null]])('rejects a money event whose amount is %p', (amount) => {
    expect(validateImport([{ ...income, amount }]).ok).toBe(false);
  });

  it('rejects an expense with no category', () => {
    const { category: _omitted, ...noCategory } = expense;
    expect(validateImport([noCategory]).ok).toBe(false);
  });

  it('rejects reserved object keys', () => {
    const hostile = JSON.parse('{"id":"x","type":"income","timestamp":"2026-01-01T10:00:00.000Z","amount":1,"__proto__":{"polluted":true}}');
    expect(validateImport([hostile])).toEqual({ ok: false, reason: expect.stringContaining('reserved key') });
  });

  it('names which event was the problem', () => {
    const result = validateImport([income, expense, { id: 'z', type: 'nope', timestamp: '2026-01-01T10:00:00.000Z' }]);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('Event 3') });
  });

  // Rejected whole, never half-imported: a partial ledger is worse than none,
  // because it looks like it worked.
  it('refuses the whole file when one event is bad', () => {
    expect(validateImport([income, { id: 'bad', type: 'income', timestamp: 'nope', amount: 1 }]).ok).toBe(false);
  });

  // Bounded before the fold, not after: an unbounded array would hang the tab
  // before anything could report why.
  it('refuses a file far larger than a lifetime of logging', () => {
    const result = validateImport(new Array(500_001).fill(income));
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('past anything this can be') });
  });
});
