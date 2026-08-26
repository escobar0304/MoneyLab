import type { LedgerEvent } from '../core/types';
import { foldVehicles } from './vehicles';

export interface FiscalDeadline {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD, the next occurrence from `now`
  amount?: number;
  note?: string;
}

/** The next date an annual MM-DD anniversary falls on, from `now` — today
 * counts as "next" so a due date isn't skipped on the day itself. */
function nextOccurrence(monthDay: string, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const candidate = `${year}-${monthDay}`;
  return candidate >= today ? candidate : `${year + 1}-${monthDay}`;
}

/** One year before a YYYY-MM-DD date, as a string — the start of the window
 * a payment could fall in and still count as covering that occurrence. */
function oneYearBefore(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year - 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Whether an occurrence has already been settled — a real expense, tagged to
 * this vehicle and this installment, logged sometime in the year leading up
 * to it. Scoped to that one-year window rather than "ever paid", or a single
 * old payment would hide every future cycle's due date forever.
 */
function isSettled(events: LedgerEvent[], vehicleId: string, installmentIndex: number, occurrenceDate: string, today: string): boolean {
  const windowStart = oneYearBefore(occurrenceDate);
  return events.some(
    (e) =>
      e.type === 'expense' &&
      e.vehicleId === vehicleId &&
      (e.installmentIndex ?? 0) === installmentIndex &&
      e.timestamp.slice(0, 10) > windowStart &&
      e.timestamp.slice(0, 10) <= today
  );
}

/**
 * Dates that recur every year regardless of anything logged in the ledger.
 *
 * Just the one so far: the IRS (Modelo 3) filing deadline. Stated plainly
 * rather than derived, because unlike a vehicle's IUC this isn't something
 * any user input could make more precise — it's the same date for everyone,
 * published once a year, and the one thing worth double-checking is whether
 * it moved in the current state budget.
 */
const FIXED_DEADLINES: { id: string; label: string; monthDay: string; note: string }[] = [
  {
    id: 'irs-modelo3',
    label: 'IRS (Modelo 3) filing deadline',
    monthDay: '06-30',
    note: 'The filing window opens 1 April. Confirm the exact dates for the current year.',
  },
];

export function fixedDeadlines(now: Date = new Date()): FiscalDeadline[] {
  return FIXED_DEADLINES.map((d) => ({ id: d.id, label: d.label, date: nextOccurrence(d.monthDay, now), note: d.note }));
}

/**
 * Every vehicle's next payment(s) — one per installment, or a single one
 * covering the full amount in the registration month when none are set.
 *
 * An occurrence already settled by a tagged expense is left out entirely
 * rather than shown with a "paid" label: the point of a calendar is what
 * still needs doing, and a real record of the payment already exists in
 * History like any other expense. It reappears on its own once the next
 * cycle's due date arrives.
 */
export function vehicleDeadlines(events: LedgerEvent[], now: Date = new Date()): FiscalDeadline[] {
  const today = now.toISOString().slice(0, 10);
  const out: FiscalDeadline[] = [];
  for (const vehicle of foldVehicles(events)) {
    const installments =
      vehicle.installments && vehicle.installments.length > 0
        ? vehicle.installments
        : [{ monthDay: vehicle.registrationDate.slice(5, 10), amount: vehicle.amount }];

    installments.forEach((installment, i) => {
      const date = nextOccurrence(installment.monthDay, now);
      if (isSettled(events, vehicle.id, i, date, today)) return;
      out.push({ id: `${vehicle.id}-${i}`, label: `IUC · ${vehicle.plate}`, date, amount: installment.amount });
    });
  }
  return out;
}

/** Everything worth putting on one calendar, in the order it happens. */
export function fiscalCalendar(events: LedgerEvent[], now: Date = new Date()): FiscalDeadline[] {
  return [...fixedDeadlines(now), ...vehicleDeadlines(events, now)].sort((a, b) => a.date.localeCompare(b.date));
}
