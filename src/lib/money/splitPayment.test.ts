import { describe, it, expect } from 'vitest';
import { splitPayment } from './splitPayment';

describe('splitPayment', () => {
  it('divides evenly across months with no interest', () => {
    const rows = splitPayment(1200, 12, 0, '2026-01-15');
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.amount === 100)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(1200, 2);
  });

  it('preserves the day of month across instalments', () => {
    const rows = splitPayment(300, 3, 0, '2026-01-31');
    // Clamped to the last day of February, then back to the 31st in March —
    // the same "sticky clamping" fix occurrenceAt already covers.
    expect(rows[0].date.slice(0, 10)).toBe('2026-01-31');
    expect(rows[1].date.slice(0, 10)).toBe('2026-02-28');
    expect(rows[2].date.slice(0, 10)).toBe('2026-03-31');
  });

  it('front-loads interest onto the schedule when a rate is given', () => {
    const rows = splitPayment(1200, 12, 12, '2026-01-01');
    expect(rows).toHaveLength(12);
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBeGreaterThan(1200);
  });

  it('is empty for a non-positive amount or term', () => {
    expect(splitPayment(0, 12, 0, '2026-01-01')).toEqual([]);
    expect(splitPayment(1200, 0, 0, '2026-01-01')).toEqual([]);
  });

  it('numbers instalments 1-based and reports the total count', () => {
    const rows = splitPayment(600, 3, 0, '2026-01-01');
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.count === 3)).toBe(true);
  });
});
