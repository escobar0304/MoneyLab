import { describe, it, expect } from 'vitest';
import { buildIrsExport, irsExportToCsv } from './irsExport';
import type { LedgerEvent } from './types';

let seq = 0;
const expense = (amount: number, category: string, date: string, note?: string): LedgerEvent => ({
  id: `x${seq++}`,
  type: 'expense',
  timestamp: `${date}T10:00:00.000Z`,
  amount,
  category,
  note,
});
const map = (category: string, ruleId: string | null): LedgerEvent => ({
  id: `m${seq++}`,
  type: 'deduction_map',
  timestamp: '2026-01-01T00:00:00.000Z',
  category,
  ruleId,
});

describe('buildIrsExport', () => {
  it('lists one row per deductible entry, sorted by heading then date', () => {
    const events = [
      map('Saúde', 'saude'),
      map('Escola', 'educacao'),
      expense(200, 'Saúde', '2026-03-10'),
      expense(100, 'Escola', '2026-01-05'),
      expense(50, 'Saúde', '2026-01-01'),
    ];
    const out = buildIrsExport(events, 2026);
    expect(out.rows.map((r) => [r.heading, r.date])).toEqual([
      ['Educação e formação', '2026-01-05'],
      ['Saúde', '2026-01-01'],
      ['Saúde', '2026-03-10'],
    ]);
  });

  it('leaves out expenses in categories that were never filed', () => {
    const out = buildIrsExport([expense(900, 'Rent', '2026-03-01')], 2026);
    expect(out.rows).toHaveLength(0);
  });

  it('counts only the year asked for', () => {
    const events = [map('Saúde', 'saude'), expense(500, 'Saúde', '2025-03-01'), expense(300, 'Saúde', '2026-03-01')];
    expect(buildIrsExport(events, 2026).rows).toHaveLength(1);
    expect(buildIrsExport(events, 2025).rows).toHaveLength(1);
  });

  it('carries the note through, for entries that have one', () => {
    const events = [map('Saúde', 'saude'), expense(80, 'Saúde', '2026-03-01', 'Dentist')];
    expect(buildIrsExport(events, 2026).rows[0].note).toBe('Dentist');
  });

  it('summarizes only headings with something actually filed under them', () => {
    // 'saude' has a mapped category, every other heading has none this run —
    // an empty summary row would read as "checked, zero", not "nothing here".
    const events = [map('Saúde', 'saude'), expense(1000, 'Saúde', '2026-03-01')];
    const out = buildIrsExport(events, 2026);
    expect(out.summary.map((s) => s.rule.id)).toEqual(['saude']);
    expect(out.totalDeduction).toBe(150); // 15% of 1 000
  });
});

describe('irsExportToCsv', () => {
  it('lists every line item, then a summary table, then the grand total', () => {
    const events = [map('Saúde', 'saude'), expense(1000, 'Saúde', '2026-03-01', 'Consulta')];
    const csv = irsExportToCsv(buildIrsExport(events, 2026));
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('IRS deductions 2026');
    expect(lines[2]).toBe('Date,Heading,Category,Note,Amount');
    expect(lines[3]).toBe('2026-03-01,Saúde,Saúde,Consulta,1000.00');
    // A blank line separates the line items from the per-heading summary.
    const summaryHeaderIndex = lines.indexOf('Heading,Categories,Spend,Deduction,Ceiling');
    expect(lines[summaryHeaderIndex - 1]).toBe('');
    expect(lines[summaryHeaderIndex + 1]).toBe('Saúde,Saúde,1000.00,150.00,1000.00');
    expect(lines.at(-1)).toBe('Total deduction,,,150.00,');
  });

  it('quotes a field that contains a comma', () => {
    const events = [map('Restaurantes, Cafés', 'fatura'), expense(20, 'Restaurantes, Cafés', '2026-03-01')];
    const csv = irsExportToCsv(buildIrsExport(events, 2026));
    expect(csv).toContain('"Restaurantes, Cafés"');
  });
});
