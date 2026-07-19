import type { Subscription, SubscriptionCycle } from './types';

export function addCycle(date: Date, cycle: SubscriptionCycle): Date {
  const d = new Date(date);
  if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** The first charge boundary for a subscription: its most recent charge, or (if never
 * charged) its trial end date, or its start date. */
function firstChargeAnchor(sub: Subscription): Date {
  return new Date(sub.lastChargedDate ?? sub.trialEndDate ?? sub.startDate);
}

/**
 * Simulated charge dates that have elapsed but haven't been recorded yet, up to `upTo`.
 * Used on app load to append subscription_charge ledger events for cycles that passed
 * while the app was closed.
 */
export function elapsedChargeDates(sub: Subscription, upTo: Date = new Date()): Date[] {
  const anchor = firstChargeAnchor(sub);
  const dates: Date[] = [];

  if (!sub.lastChargedDate && anchor.getTime() <= upTo.getTime()) {
    dates.push(new Date(anchor));
  }

  let next = addCycle(anchor, sub.cycle);
  while (next.getTime() <= upTo.getTime()) {
    dates.push(new Date(next));
    next = addCycle(next, sub.cycle);
  }
  return dates;
}

/** Next renewal date strictly after `from`. */
export function nextRenewalDate(sub: Subscription, from: Date = new Date()): Date {
  const anchor = firstChargeAnchor(sub);
  let candidate = sub.lastChargedDate ? addCycle(anchor, sub.cycle) : new Date(anchor);
  while (candidate.getTime() <= from.getTime()) {
    candidate = addCycle(candidate, sub.cycle);
  }
  return candidate;
}

export function monthlyEquivalent(sub: Subscription): number {
  if (sub.cycle === 'monthly') return sub.amount;
  if (sub.cycle === 'weekly') return (sub.amount * 52) / 12;
  return sub.amount / 12;
}

export function annualEquivalent(sub: Subscription): number {
  if (sub.cycle === 'yearly') return sub.amount;
  if (sub.cycle === 'weekly') return sub.amount * 52;
  return sub.amount * 12;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const ms = date.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
