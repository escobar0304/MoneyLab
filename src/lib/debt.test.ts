import { describe, it, expect } from 'vitest';
import { scheduledPayment, amortize, debtSummary, overpaymentEffect, totalOwed, foldDebts } from './debt';
import type { Debt, LedgerEvent } from './types';

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1',
  label: 'Mortgage',
  principal: 200_000,
  annualRate: 3.6,
  termMonths: 360,
  startDate: '2020-01-01',
  active: true,
  ...over,
});

describe('scheduledPayment', () => {
  it('matches the annuity formula for a textbook mortgage', () => {
    // 200 000 at 3.6% nominal over 30 years ≈ 909.29/month.
    expect(scheduledPayment(200_000, 3.6, 360)).toBeCloseTo(909.29, 1);
  });

  it('divides evenly when there is no interest', () => {
    // The formula divides by zero here; the zero-rate branch is not academic —
    // interest-free instalment plans and family loans are real.
    expect(scheduledPayment(1200, 0, 12)).toBe(100);
  });

  it('is zero for a loan with no principal or no term', () => {
    expect(scheduledPayment(0, 5, 120)).toBe(0);
    expect(scheduledPayment(1000, 5, 0)).toBe(0);
  });
});

describe('amortize', () => {
  it('runs for exactly the term and finishes at zero', () => {
    // Never 361: rounding each instalment to cents leaves a residue that would
    // otherwise sprout an extra month at the end of a 30-year loan.
    const rows = amortize(debt());
    expect(rows).toHaveLength(360);
    expect(rows[rows.length - 1].balance).toBeLessThanOrEqual(0.005);
  });

  it('charges more interest than capital at the start and reverses by the end', () => {
    const rows = amortize(debt());
    expect(rows[0].interest).toBeGreaterThan(rows[0].principal);
    expect(rows[359].principal).toBeGreaterThan(rows[359].interest);
  });

  it('starts in the month the loan starts and steps one month at a time', () => {
    const rows = amortize(debt({ startDate: '2020-11-15' }));
    expect(rows[0].month).toBe('2020-11');
    expect(rows[1].month).toBe('2020-12');
    expect(rows[2].month).toBe('2021-01'); // the year boundary, where naive month maths breaks
  });

  it('shortens the schedule when overpaying', () => {
    const plain = amortize(debt());
    const extra = amortize(debt({ extraPayment: 200 }));
    expect(extra.length).toBeLessThan(plain.length);
    expect(extra[extra.length - 1].balance).toBeLessThanOrEqual(0.005);
  });

  it('never takes a final payment larger than what is left', () => {
    const rows = amortize(debt({ principal: 1000, annualRate: 5, termMonths: 12, extraPayment: 300 }));
    const last = rows[rows.length - 1];
    expect(last.payment).toBeLessThanOrEqual(rows[0].payment);
    expect(last.balance).toBeLessThanOrEqual(0.005);
  });

  it('bails out instead of looping when the payment cannot cover the interest', () => {
    // A rate this absurd makes the scheduled payment smaller than the monthly
    // interest; without the guard this would spin to the iteration cap and
    // return a schedule that says nothing.
    const rows = amortize({ ...debt({ principal: 100_000, annualRate: 900, termMonths: 360 }) });
    expect(rows.length).toBeLessThan(360);
  });
});

describe('debtSummary', () => {
  it('splits what is paid from what is left, as of a date', () => {
    // Two years into a 30-year loan.
    const s = debtSummary(debt(), new Date('2021-12-31T00:00:00.000Z'));
    expect(s.paymentsMade).toBe(24);
    expect(s.paymentsRemaining).toBe(336);
    expect(s.balance).toBeLessThan(200_000);
    expect(s.balance).toBeGreaterThan(190_000); // barely any capital repaid this early
    expect(s.interestPaid).toBeGreaterThan(s.paidOff);
  });

  it('totals the interest over the whole term', () => {
    const s = debtSummary(debt(), new Date('2020-01-01T00:00:00.000Z'));
    // ~127k of interest on 200k — the number the headline rate hides.
    expect(s.totalInterest).toBeGreaterThan(120_000);
    expect(s.interestRatio).toBeGreaterThan(0.6);
  });

  it('is settled once the schedule has run out', () => {
    const s = debtSummary(debt({ principal: 1200, annualRate: 0, termMonths: 12 }), new Date('2021-06-01T00:00:00.000Z'));
    expect(s.settled).toBe(true);
    expect(s.balance).toBe(0);
  });

  it('reports nothing paid before the first payment is due', () => {
    const s = debtSummary(debt({ startDate: '2030-01-01' }), new Date('2026-01-01T00:00:00.000Z'));
    expect(s.paymentsMade).toBe(0);
    expect(s.balance).toBe(200_000);
  });
});

describe('overpaymentEffect', () => {
  it('reports months and interest saved', () => {
    const effect = overpaymentEffect(debt(), 200);
    expect(effect.monthsSaved).toBeGreaterThan(60);
    expect(effect.interestSaved).toBeGreaterThan(30_000);
    expect(effect.payoffMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('saves nothing for an overpayment of zero', () => {
    expect(overpaymentEffect(debt(), 0)).toMatchObject({ monthsSaved: 0, interestSaved: 0 });
  });

  it('stacks on top of an overpayment already committed to', () => {
    const already = debt({ extraPayment: 100 });
    const effect = overpaymentEffect(already, 100);
    // Compared against the 100 already being paid, not against zero.
    expect(effect.monthsSaved).toBeLessThan(overpaymentEffect(debt(), 200).monthsSaved);
    expect(effect.monthsSaved).toBeGreaterThan(0);
  });
});

describe('totalOwed', () => {
  it('adds up live balances and ignores paused loans', () => {
    const now = new Date('2021-01-01T00:00:00.000Z');
    const owed = totalOwed([debt({ id: 'a' }), debt({ id: 'b', active: false })], now);
    const one = debtSummary(debt({ id: 'a' }), now).balance;
    expect(owed).toBeCloseTo(one, 2);
  });

  it('is zero with no debts', () => {
    expect(totalOwed([])).toBe(0);
  });
});

describe('foldDebts', () => {
  it('applies the latest upsert and drops removals', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'debt_upsert', timestamp: '2026-01-01T00:00:00.000Z', debt: debt({ id: 'a', principal: 100 }) },
      { id: '2', type: 'debt_upsert', timestamp: '2026-02-01T00:00:00.000Z', debt: debt({ id: 'b', label: 'Car' }) },
      { id: '3', type: 'debt_upsert', timestamp: '2026-03-01T00:00:00.000Z', debt: debt({ id: 'a', principal: 500 }) },
      { id: '4', type: 'debt_remove', timestamp: '2026-03-02T00:00:00.000Z', debtId: 'b' },
    ];
    const debts = foldDebts(events);
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({ id: 'a', principal: 500 });
  });
});
