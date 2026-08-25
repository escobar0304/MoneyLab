import type { LedgerEvent } from './types';
import { deductionSummary, foldDeductionMap, ruleById, totalDeduction, type DeductionStatus } from './irs';
import { monthKey } from './derive';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface IrsExportRow {
  date: string; // YYYY-MM-DD
  heading: string;
  category: string;
  note?: string;
  amount: number;
}

export interface IrsExport {
  year: number;
  rows: IrsExportRow[];
  summary: DeductionStatus[];
  totalDeduction: number;
}

/**
 * Every deductible expense for a year, one line per entry, plus the same
 * per-heading totals the panel already shows.
 *
 * This is the whole handoff: an accountant checking a heading's total against
 * the entries behind it doesn't need to be told what "Saúde" adds up to, or
 * asked to trust it — the line items are right there. Headings with nothing
 * filed under them are left out of the summary; an empty row would read as
 * "checked and found zero" rather than "nothing here to check".
 */
export function buildIrsExport(events: LedgerEvent[], year: number): IrsExport {
  const map = foldDeductionMap(events);
  const prefix = String(year);

  const rows: IrsExportRow[] = [];
  for (const e of events) {
    if (e.type !== 'expense') continue;
    if (monthKey(e.timestamp).slice(0, 4) !== prefix) continue;
    const ruleId = map.get(e.category);
    if (!ruleId) continue;
    const rule = ruleById(ruleId);
    if (!rule) continue;
    rows.push({
      date: e.timestamp.slice(0, 10),
      heading: rule.label,
      category: e.category,
      note: e.note,
      amount: roundCents(e.amount),
    });
  }
  rows.sort((a, b) => a.heading.localeCompare(b.heading) || a.date.localeCompare(b.date));

  const summary = deductionSummary(events, year).filter((s) => s.categories.length > 0);

  return { year, rows, summary, totalDeduction: totalDeduction(summary) };
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields: (string | number)[]): string {
  return fields.map(csvField).join(',');
}

/**
 * One CSV, two tables stacked with a blank line between: every line item
 * first — what gets reconciled against actual invoices — then the
 * per-heading totals that go on the return. One file to hand over, rather
 * than a spreadsheet and a screenshot of the app.
 */
export function irsExportToCsv(data: IrsExport): string {
  const lines: string[] = [];
  lines.push(`IRS deductions ${data.year}`);
  lines.push('');
  lines.push(csvLine(['Date', 'Heading', 'Category', 'Note', 'Amount']));
  for (const row of data.rows) {
    lines.push(csvLine([row.date, row.heading, row.category, row.note ?? '', row.amount.toFixed(2)]));
  }
  lines.push('');
  lines.push(csvLine(['Heading', 'Categories', 'Spend', 'Deduction', 'Ceiling']));
  for (const s of data.summary) {
    lines.push(csvLine([s.rule.label, s.categories.join('; '), s.spend.toFixed(2), s.deduction.toFixed(2), s.cap.toFixed(2)]));
  }
  lines.push('');
  lines.push(csvLine(['Total deduction', '', '', data.totalDeduction.toFixed(2), '']));
  return lines.join('\r\n');
}
