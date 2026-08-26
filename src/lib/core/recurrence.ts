import type { RecurringSchedule } from './types';

/** Hard stop on the generator loop. 100 years of monthly cycles is far beyond any
 * real schedule, so hitting it means the input was bad — better to bail than to
 * spin forever on a malformed startDate. */
const MAX_OCCURRENCES = 1200;

/**
 * The nth payment date for a schedule, counting the start date as n = 0.
 *
 * Computed from the original anchor every time rather than by repeatedly adding
 * a month, which matters in two ways that each silently file a payment under the
 * wrong month:
 *
 * 1. **DST.** Ledger timestamps are UTC midnight, but local-time month
 *    arithmetic puts 1 April 00:00 local at 31 March 23:00Z in any timezone that
 *    springs forward — Lisbon included. April's payment landed in March,
 *    doubling one month and emptying the next, every year. All arithmetic here
 *    is UTC.
 * 2. **Sticky clamping.** Stepping month by month from a 31st gives
 *    31 Jan → 28 Feb → 28 Mar: once clamped, the day never recovers. Deriving
 *    each occurrence from the anchor keeps it 31 Jan → 28 Feb → 31 Mar.
 */
export function occurrenceAt(sched: RecurringSchedule, index: number): Date | null {
  const start = new Date(sched.startDate);
  if (Number.isNaN(start.getTime())) return null;

  const anchorDay = start.getUTCDate();
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + index;
  // Day 0 of the following month is the last day of this one.
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchorDay, lastDayOfTarget),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}

/** One month on from `date`, preserving the day where the target month allows it. */
export function addCycle(date: Date): Date {
  return occurrenceAt({ cycle: 'monthly', startDate: date.toISOString() }, 1) ?? new Date(date);
}

/**
 * Every payment date from the schedule's start up to `upTo`, inclusive.
 *
 * Always returns the *full* series, leaving the caller to skip months already
 * paid or explicitly skipped. That is what makes generation idempotent: running
 * it twice, or after a payment has been deleted, produces the same answer.
 */
export function occurrencesUpTo(sched: RecurringSchedule, upTo: Date = new Date()): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const date = occurrenceAt(sched, i);
    if (!date || date.getTime() > upTo.getTime()) break;
    dates.push(date);
  }
  return dates;
}

/** Next payment strictly after `from`. */
export function nextRenewalDate(sched: RecurringSchedule, from: Date = new Date()): Date | null {
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const date = occurrenceAt(sched, i);
    if (!date) return null;
    if (date.getTime() > from.getTime()) return date;
  }
  return null;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.ceil((date.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
