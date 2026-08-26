import { describe, it, expect } from 'vitest';
import { applyWhatIf, monthlyEffect, type WhatIfAdjustment } from './whatif';
import { foldRecurring } from '../core/entities';
import { projectRunway } from './runway';
import type { LedgerEvent } from '../core/types';

const now = new Date('2026-06-15T00:00:00.000Z');

describe('applyWhatIf', () => {
  it('never mutates the real ledger it is handed', () => {
    const events: LedgerEvent[] = [{ id: 'i1', type: 'income', timestamp: '2026-06-01T00:00:00.000Z', amount: 2000, label: 'Salary' }];
    const before = events.length;
    applyWhatIf(events, [{ id: 'a', kind: 'oneOff', direction: 'expense', label: 'Trip', amount: 500 }], now);
    expect(events).toHaveLength(before);
  });

  it('adds a new active recurring rule that a real projection then picks up', () => {
    const adjustments: WhatIfAdjustment[] = [{ id: 'raise', kind: 'recurring', direction: 'income', label: 'Freelance', amount: 300 }];
    const out = applyWhatIf([], adjustments, now);
    const rules = foldRecurring(out);
    expect(rules).toEqual([expect.objectContaining({ kind: 'income', label: 'Freelance', amount: 300, active: true })]);
  });

  it('cancelling a real rule removes it from the folded set', () => {
    const events: LedgerEvent[] = [
      {
        id: 'rule-nf',
        type: 'recurring_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        rule: { id: 'nf', kind: 'expense', label: 'Netflix', amount: 9.99, cycle: 'monthly', startDate: '2026-01-05', active: true },
      },
    ];
    const adjustments: WhatIfAdjustment[] = [{ id: 'a', kind: 'cancel', recurringId: 'nf', direction: 'expense', label: 'Netflix', amount: 9.99 }];
    const out = applyWhatIf(events, adjustments, now);
    expect(foldRecurring(out).find((r) => r.id === 'nf')).toBeUndefined();
  });

  it('posts a one-off as a single dated entry, not a recurring rule', () => {
    const out = applyWhatIf([], [{ id: 'a', kind: 'oneOff', direction: 'expense', label: 'New laptop', amount: 1200 }], now);
    expect(out).toEqual([expect.objectContaining({ type: 'expense', amount: 1200, category: 'New laptop' })]);
    expect(foldRecurring(out)).toHaveLength(0);
  });

  it('feeds straight into the real runway projection, no separate arithmetic', () => {
    const events: LedgerEvent[] = [{ id: 'i1', type: 'income', timestamp: '2026-05-01T00:00:00.000Z', amount: 1000, label: 'Salary' }];
    const adjustments: WhatIfAdjustment[] = [{ id: 'raise', kind: 'recurring', direction: 'income', label: 'Side gig', amount: 200 }];
    const hypothetical = applyWhatIf(events, adjustments, now);

    const base = projectRunway(events, { days: 60, now });
    const withRaise = projectRunway(hypothetical, { days: 60, now });
    // One extra 200/month landing inside the 60-day window must show up as
    // a strictly higher balance by the end of it.
    expect(withRaise.days.at(-1)!.expected).toBeGreaterThan(base.days.at(-1)!.expected);
  });
});

describe('monthlyEffect', () => {
  it('adds a new recurring income, subtracts a new recurring expense', () => {
    const adjustments: WhatIfAdjustment[] = [
      { id: 'a', kind: 'recurring', direction: 'income', label: 'Side gig', amount: 300 },
      { id: 'b', kind: 'recurring', direction: 'expense', label: 'Gym', amount: 40 },
    ];
    expect(monthlyEffect(adjustments)).toBe(260);
  });

  it('cancelling an expense rule frees up money; cancelling an income rule loses it', () => {
    const adjustments: WhatIfAdjustment[] = [
      { id: 'a', kind: 'cancel', recurringId: 'nf', direction: 'expense', label: 'Netflix', amount: 9.99 },
      { id: 'b', kind: 'cancel', recurringId: 'side', direction: 'income', label: 'Side gig', amount: 300 },
    ];
    expect(monthlyEffect(adjustments)).toBeCloseTo(9.99 - 300, 5);
  });

  it('ignores one-off adjustments, which do not repeat', () => {
    expect(monthlyEffect([{ id: 'a', kind: 'oneOff', direction: 'expense', label: 'Trip', amount: 5000 }])).toBe(0);
  });
});
