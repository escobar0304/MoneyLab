import type { Debt } from '../core/types';
import { amortize } from '../planning/debt';
import { occurrenceAt } from '../core/recurrence';

export interface SplitInstallment {
  /** 1-based payment number. */
  index: number;
  count: number;
  date: string; // ISO datetime
  amount: number;
}

/**
 * Splits `amount` into `months` payments starting on `startDate`, optionally
 * amortized at `annualRate` — "pay over N months with interest" is the same
 * annuity schedule a loan uses, so this reuses `amortize` instead of
 * duplicating the rate math. A 0 rate divides evenly, with any rounding
 * remainder folded into the last payment, exactly as `amortize` already does
 * for a loan's final instalment.
 */
export function splitPayment(amount: number, months: number, annualRate: number, startDate: string): SplitInstallment[] {
  if (months <= 0 || amount <= 0) return [];

  const rows = amortize({
    id: 'split',
    label: '',
    principal: amount,
    annualRate,
    termMonths: Math.round(months),
    startDate,
    active: true,
  } satisfies Debt);

  return rows.map((row) => ({
    index: row.index,
    count: rows.length,
    // amortize() only carries a YYYY-MM month; the real calendar date (with
    // day-of-month preserved and end-of-month clamping handled) comes from
    // the same anchor math recurring rules use.
    date: (occurrenceAt({ cycle: 'monthly', startDate }, row.index - 1) ?? new Date(startDate)).toISOString(),
    amount: row.payment,
  }));
}
