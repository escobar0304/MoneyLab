import type { LedgerEvent, Debt } from './types';
import { monthKey } from './derive';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function ordinal(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return year * 12 + (m - 1);
}

function fromOrdinal(n: number): string {
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

/** Hard stop on the schedule loop. 100 years of monthly payments — long past any
 * real term, and the guard that keeps a pathological rate from hanging the tab. */
const MAX_PAYMENTS = 1200;

/** Current debts, latest upsert wins, removals drop out. */
export function foldDebts(events: LedgerEvent[]): Debt[] {
  const byId = new Map<string, Debt>();
  for (const e of events) {
    if (e.type === 'debt_upsert') byId.set(e.debt.id, { ...e.debt });
    else if (e.type === 'debt_remove') byId.delete(e.debtId);
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The fixed monthly payment that clears `principal` over `termMonths` — the
 * standard annuity formula lenders quote.
 *
 *   payment = P · i / (1 − (1+i)^−n)
 *
 * A zero rate divides by zero there, so it falls back to straight division;
 * that is not an edge case worth ignoring, since interest-free family loans and
 * 0% instalment plans are real.
 */
export function scheduledPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  const i = annualRate / 100 / 12;
  if (i === 0) return roundCents(principal / termMonths);
  return roundCents((principal * i) / (1 - Math.pow(1 + i, -termMonths)));
}

export interface AmortizationRow {
  /** 1-based payment number. */
  index: number;
  month: string; // YYYY-MM
  payment: number;
  interest: number;
  principal: number;
  /** What is still owed after this payment. */
  balance: number;
}

/**
 * The full payment-by-payment schedule.
 *
 * Interest is charged on the balance that remains *before* each payment, so
 * paying extra early removes interest from every month that follows — which is
 * the entire point of the overpayment feature and the reason this is computed
 * rather than approximated.
 */
export function amortize(debt: Debt): AmortizationRow[] {
  const base = scheduledPayment(debt.principal, debt.annualRate, debt.termMonths);
  const extra = debt.extraPayment ?? 0;
  const i = debt.annualRate / 100 / 12;
  const startOrdinal = ordinal(monthKey(debt.startDate));

  const rows: AmortizationRow[] = [];
  let balance = debt.principal;

  // Overpaying can only ever shorten a loan, so the term is a hard ceiling.
  // Without it, rounding each instalment to whole cents leaves a few cents
  // outstanding after the last scheduled payment and the schedule sprouts a
  // spurious 361st month — which lenders handle by adjusting the final
  // instalment, exactly as the `isFinal` branch does here.
  const lastPayment = Math.min(debt.termMonths, MAX_PAYMENTS);

  for (let n = 1; n <= lastPayment && balance > 0.005; n++) {
    const interest = roundCents(balance * i);
    // A rate so high that the scheduled payment never covers the interest would
    // otherwise run the full term producing a schedule that says nothing.
    if (base + extra <= interest) break;

    // The final payment is only what is left, never the full instalment.
    const payment =
      n === lastPayment ? roundCents(balance + interest) : Math.min(roundCents(base + extra), roundCents(balance + interest));
    const principal = roundCents(payment - interest);
    balance = roundCents(balance - principal);

    rows.push({ index: n, month: fromOrdinal(startOrdinal + n - 1), payment, interest, principal, balance });
  }

  return rows;
}

export interface DebtSummary {
  debt: Debt;
  monthlyPayment: number;
  /** Still owed as of `now`. */
  balance: number;
  paidOff: number;
  interestPaid: number;
  interestRemaining: number;
  totalInterest: number;
  /** Interest as a share of what was borrowed — the number that makes a rate
   * concrete ("3.4%" means nothing; "you pay €47k of interest" does). */
  interestRatio: number;
  paymentsMade: number;
  paymentsRemaining: number;
  payoffMonth: string | null;
  /** True once the schedule is complete. */
  settled: boolean;
}

export function debtSummary(debt: Debt, now: Date = new Date()): DebtSummary {
  const schedule = amortize(debt);
  const nowOrdinal = ordinal(monthKey(now.toISOString()));

  let interestPaid = 0;
  let totalInterest = 0;
  let paymentsMade = 0;
  let balance = debt.principal;
  let paidOff = 0;

  for (const row of schedule) {
    totalInterest += row.interest;
    if (ordinal(row.month) <= nowOrdinal) {
      interestPaid += row.interest;
      paidOff += row.principal;
      balance = row.balance;
      paymentsMade++;
    }
  }

  const last = schedule[schedule.length - 1];
  return {
    debt,
    monthlyPayment: roundCents(scheduledPayment(debt.principal, debt.annualRate, debt.termMonths) + (debt.extraPayment ?? 0)),
    balance: roundCents(balance),
    paidOff: roundCents(paidOff),
    interestPaid: roundCents(interestPaid),
    interestRemaining: roundCents(totalInterest - interestPaid),
    totalInterest: roundCents(totalInterest),
    interestRatio: debt.principal > 0 ? totalInterest / debt.principal : 0,
    paymentsMade,
    paymentsRemaining: schedule.length - paymentsMade,
    payoffMonth: last ? last.month : null,
    settled: balance <= 0.005,
  };
}

export interface OverpaymentEffect {
  extra: number;
  monthsSaved: number;
  interestSaved: number;
  payoffMonth: string | null;
}

/**
 * What paying `extra` more each month would buy, against the debt as it stands.
 *
 * Reported as months and euros saved rather than a new total, because "you'd
 * finish 4 years earlier and keep €18,400" is a decision; "your total would be
 * €212,600" is a number nobody can act on.
 */
export function overpaymentEffect(debt: Debt, extra: number): OverpaymentEffect {
  const current = amortize(debt);
  const improved = amortize({ ...debt, extraPayment: (debt.extraPayment ?? 0) + extra });

  const interestOf = (rows: AmortizationRow[]) => rows.reduce((sum, r) => sum + r.interest, 0);
  const last = improved[improved.length - 1];

  return {
    extra,
    monthsSaved: current.length - improved.length,
    interestSaved: roundCents(interestOf(current) - interestOf(improved)),
    payoffMonth: last ? last.month : null,
  };
}

/** Everything still owed across all active debts — the term that turns a
 * portfolio total into an actual net worth. */
export function totalOwed(debts: Debt[], now: Date = new Date()): number {
  let total = 0;
  for (const debt of debts) {
    if (!debt.active) continue;
    total += debtSummary(debt, now).balance;
  }
  return roundCents(total);
}
