import type { RecurringSchedule } from './types';

export function addCycle(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** The first charge boundary for a recurring schedule (currently just the monthly
 * salary): its most recent charge, or (if never charged) its start date. */
function firstChargeAnchor(sched: RecurringSchedule): Date {
  return new Date(sched.lastChargedDate ?? sched.startDate);
}

/**
 * Simulated charge dates that have elapsed but haven't been recorded yet, up to `upTo`.
 * Used on app load to append one income event per elapsed monthly cycle for cycles
 * that passed while the app was closed.
 */
export function elapsedChargeDates(sched: RecurringSchedule, upTo: Date = new Date()): Date[] {
  const anchor = firstChargeAnchor(sched);
  const dates: Date[] = [];

  if (!sched.lastChargedDate && anchor.getTime() <= upTo.getTime()) {
    dates.push(new Date(anchor));
  }

  let next = addCycle(anchor);
  while (next.getTime() <= upTo.getTime()) {
    dates.push(new Date(next));
    next = addCycle(next);
  }
  return dates;
}

/** Next payment date strictly after `from`. */
export function nextRenewalDate(sched: RecurringSchedule, from: Date = new Date()): Date {
  const anchor = firstChargeAnchor(sched);
  let candidate = sched.lastChargedDate ? addCycle(anchor) : new Date(anchor);
  while (candidate.getTime() <= from.getTime()) {
    candidate = addCycle(candidate);
  }
  return candidate;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const ms = date.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
