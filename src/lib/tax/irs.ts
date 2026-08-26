import type { LedgerEvent } from '../core/types';
import { monthKey } from '../core/derive';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DeductionRule {
  id: string;
  label: string;
  /** Share of the spend that becomes a deduction. 0.15 = 15%. */
  rate: number;
  /** Annual ceiling on the deduction itself, not on the spending. */
  cap: number;
  hint: string;
}

/**
 * The standard IRS deduction headings, with the commonly published rates and
 * ceilings as defaults.
 *
 * These figures move with each state budget, and the household ceilings depend
 * on filing status — so they are **defaults to check against your own
 * settlement**, not authority. Every ceiling is editable and the UI says so.
 * The value here is not the arithmetic, which is trivial; it is knowing in
 * September that you are €400 short of a ceiling you could still reach.
 */
export const IRS_DEDUCTIONS: DeductionRule[] = [
  {
    id: 'geral',
    label: 'Despesas gerais familiares',
    rate: 0.35,
    cap: 250,
    hint: 'Any invoice with your NIF that has no more specific heading.',
  },
  { id: 'saude', label: 'Saúde', rate: 0.15, cap: 1000, hint: 'Consultations, medicines, health insurance.' },
  { id: 'educacao', label: 'Educação e formação', rate: 0.3, cap: 800, hint: 'Tuition, books, school meals.' },
  { id: 'habitacao', label: 'Encargos com habitação', rate: 0.15, cap: 600, hint: 'Rent on your permanent home.' },
  { id: 'lares', label: 'Lares', rate: 0.25, cap: 403.75, hint: 'Residential care for dependants.' },
  {
    id: 'fatura',
    label: 'IVA pela exigência de fatura',
    rate: 0.15,
    cap: 250,
    hint: 'Restaurants, hairdressers, garages, gyms, vets — a share of the VAT you paid.',
  },
];

export function ruleById(id: string): DeductionRule | undefined {
  return IRS_DEDUCTIONS.find((r) => r.id === id);
}

/** Which of your categories counts towards which heading. */
export function foldDeductionMap(events: LedgerEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'deduction_map') {
      if (e.ruleId) map.set(e.category, e.ruleId);
      else map.delete(e.category);
    } else if (e.type === 'category_remove') {
      // A heading must not outlive the category that fed it.
      map.delete(e.name);
    }
  }
  return map;
}

/** Ceilings as corrected by the user, falling back to the defaults above. */
export function foldDeductionCaps(events: LedgerEvent[]): Map<string, number> {
  const caps = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'deduction_cap') caps.set(e.ruleId, e.cap);
  }
  return caps;
}

export interface DeductionStatus {
  rule: DeductionRule;
  /** The ceiling actually in force — overridden or default. */
  cap: number;
  capIsCustom: boolean;
  /** What you spent in the year under the categories mapped here. */
  spend: number;
  /** What that spend is worth as a deduction, before the ceiling. */
  raw: number;
  /** After the ceiling. */
  deduction: number;
  /** Share of the ceiling reached, 0–1 and never above. */
  ratio: number;
  /** Spend that would still add something. Zero once the ceiling is reached. */
  headroomSpend: number;
  categories: string[];
}

/**
 * How far each heading has got this year.
 *
 * `headroomSpend` is the figure worth surfacing: the deduction is capped, so
 * beyond a point more spending in that category buys nothing back, and before
 * it there is a concrete amount still worth invoicing with your NIF.
 */
export function deductionSummary(events: LedgerEvent[], year: number): DeductionStatus[] {
  const map = foldDeductionMap(events);
  const caps = foldDeductionCaps(events);
  const prefix = String(year);

  const spendByRule = new Map<string, number>();
  const categoriesByRule = new Map<string, Set<string>>();

  for (const [category, ruleId] of map) {
    categoriesByRule.set(ruleId, (categoriesByRule.get(ruleId) ?? new Set()).add(category));
  }

  for (const e of events) {
    if (e.type !== 'expense') continue;
    if (monthKey(e.timestamp).slice(0, 4) !== prefix) continue;
    const ruleId = map.get(e.category);
    if (!ruleId) continue;
    spendByRule.set(ruleId, (spendByRule.get(ruleId) ?? 0) + e.amount);
  }

  return IRS_DEDUCTIONS.map((rule) => {
    const cap = caps.get(rule.id) ?? rule.cap;
    const spend = roundCents(spendByRule.get(rule.id) ?? 0);
    const raw = roundCents(spend * rule.rate);
    const deduction = roundCents(Math.min(raw, cap));
    return {
      rule,
      cap,
      capIsCustom: caps.has(rule.id),
      spend,
      raw,
      deduction,
      ratio: cap > 0 ? Math.min(deduction / cap, 1) : 0,
      headroomSpend: rule.rate > 0 ? roundCents(Math.max((cap - deduction) / rule.rate, 0)) : 0,
      categories: Array.from(categoriesByRule.get(rule.id) ?? []).sort((a, b) => a.localeCompare(b)),
    };
  });
}

/** Everything the year is worth so far, across all headings. */
export function totalDeduction(statuses: DeductionStatus[]): number {
  return roundCents(statuses.reduce((sum, s) => sum + s.deduction, 0));
}
