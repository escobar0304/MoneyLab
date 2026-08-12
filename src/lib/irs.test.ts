import { describe, it, expect } from 'vitest';
import { deductionSummary, foldDeductionMap, foldDeductionCaps, totalDeduction, IRS_DEDUCTIONS, ruleById } from './irs';
import type { LedgerEvent } from './types';

let seq = 0;
const expense = (amount: number, category: string, date: string): LedgerEvent => ({
  id: `x${seq++}`,
  type: 'expense',
  timestamp: `${date}T10:00:00.000Z`,
  amount,
  category,
});
const map = (category: string, ruleId: string | null): LedgerEvent => ({
  id: `m${seq++}`,
  type: 'deduction_map',
  timestamp: '2026-01-01T00:00:00.000Z',
  category,
  ruleId,
});

const status = (events: LedgerEvent[], id: string, year = 2026) =>
  deductionSummary(events, year).find((s) => s.rule.id === id)!;

describe('foldDeductionMap', () => {
  it('files a category and lets it be unfiled again', () => {
    expect(foldDeductionMap([map('Saúde', 'saude')]).get('Saúde')).toBe('saude');
    expect(foldDeductionMap([map('Saúde', 'saude'), map('Saúde', null)]).size).toBe(0);
  });

  it('keeps the latest heading when one is refiled', () => {
    expect(foldDeductionMap([map('Ginásio', 'saude'), map('Ginásio', 'fatura')]).get('Ginásio')).toBe('fatura');
  });

  it('drops the mapping when the category itself is removed', () => {
    // A heading must not outlive the category feeding it.
    const events: LedgerEvent[] = [map('Saúde', 'saude'), { id: 'r', type: 'category_remove', timestamp: '2026-02-01T00:00:00.000Z', name: 'Saúde' }];
    expect(foldDeductionMap(events).size).toBe(0);
  });
});

describe('deductionSummary', () => {
  it('applies the rate to what was spent under a mapped category', () => {
    // Health: 15% of 1 000 = 150, well under the 1 000 ceiling.
    const events = [map('Saúde', 'saude'), expense(1000, 'Saúde', '2026-03-01')];
    expect(status(events, 'saude')).toMatchObject({ spend: 1000, raw: 150, deduction: 150 });
  });

  it('caps the deduction without capping the spend', () => {
    // 15% of 20 000 is 3 000, but the ceiling is 1 000.
    const events = [map('Saúde', 'saude'), expense(20_000, 'Saúde', '2026-03-01')];
    const s = status(events, 'saude');
    expect({ spend: s.spend, raw: s.raw, deduction: s.deduction, ratio: s.ratio }).toEqual({
      spend: 20_000,
      raw: 3000,
      deduction: 1000,
      ratio: 1,
    });
  });

  it('says how much more spending would still be worth something', () => {
    // 150 of a 1 000 ceiling used; the remaining 850 needs 850/0.15 more spend.
    const events = [map('Saúde', 'saude'), expense(1000, 'Saúde', '2026-03-01')];
    expect(status(events, 'saude').headroomSpend).toBeCloseTo(5666.67, 1);
  });

  it('offers no headroom once the ceiling is reached', () => {
    const events = [map('Saúde', 'saude'), expense(20_000, 'Saúde', '2026-03-01')];
    expect(status(events, 'saude').headroomSpend).toBe(0);
  });

  it('counts only the year asked for', () => {
    const events = [map('Saúde', 'saude'), expense(500, 'Saúde', '2025-03-01'), expense(300, 'Saúde', '2026-03-01')];
    expect(status(events, 'saude').spend).toBe(300);
    expect(status(events, 'saude', 2025).spend).toBe(500);
  });

  it('ignores spending in categories that were never filed', () => {
    expect(status([expense(900, 'Rent', '2026-03-01')], 'habitacao').spend).toBe(0);
  });

  it('adds up several categories under one heading, and lists them', () => {
    const events = [
      map('Médico', 'saude'),
      map('Farmácia', 'saude'),
      expense(200, 'Médico', '2026-03-01'),
      expense(50, 'Farmácia', '2026-04-01'),
    ];
    const s = status(events, 'saude');
    expect(s.spend).toBe(250);
    expect(s.categories).toEqual(['Farmácia', 'Médico']);
  });

  it('returns every heading, so nothing is silently missing from the page', () => {
    expect(deductionSummary([], 2026)).toHaveLength(IRS_DEDUCTIONS.length);
  });

  it('totals the year across headings', () => {
    const events = [map('Saúde', 'saude'), map('Escola', 'educacao'), expense(1000, 'Saúde', '2026-03-01'), expense(1000, 'Escola', '2026-03-01')];
    expect(totalDeduction(deductionSummary(events, 2026))).toBe(450); // 150 + 300
  });
});

describe('editable ceilings', () => {
  it('uses an overridden ceiling and says that it is not the default', () => {
    // The ceilings move with each budget, so they must be correctable without a
    // release — and the UI has to be able to show which ones were changed.
    const events: LedgerEvent[] = [
      map('Saúde', 'saude'),
      expense(20_000, 'Saúde', '2026-03-01'),
      { id: 'c1', type: 'deduction_cap', timestamp: '2026-01-01T00:00:00.000Z', ruleId: 'saude', cap: 1500 },
    ];
    const s = status(events, 'saude');
    expect({ cap: s.cap, capIsCustom: s.capIsCustom, deduction: s.deduction }).toEqual({ cap: 1500, capIsCustom: true, deduction: 1500 });
  });

  it('falls back to the shipped default', () => {
    expect(status([map('Saúde', 'saude')], 'saude')).toMatchObject({ cap: ruleById('saude')!.cap, capIsCustom: false });
  });

  it('keeps the latest override', () => {
    const events: LedgerEvent[] = [
      { id: 'c1', type: 'deduction_cap', timestamp: '2026-01-01T00:00:00.000Z', ruleId: 'saude', cap: 1500 },
      { id: 'c2', type: 'deduction_cap', timestamp: '2026-02-01T00:00:00.000Z', ruleId: 'saude', cap: 1200 },
    ];
    expect(foldDeductionCaps(events).get('saude')).toBe(1200);
  });
});
