import type { LedgerEvent, ExpenseEvent } from '../core/types';
import { foldRecurring } from '../core/entities';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type Cadence = 'monthly' | 'yearly';

export interface DetectedSubscription {
  /** Grouping key — the note if there is one, otherwise the category. */
  key: string;
  label: string;
  category: string;
  charges: ExpenseEvent[];
  cadence: Cadence;
  /** Median gap between charges, in days. */
  intervalDays: number;
  /** The established amount, ignoring the most recent charge. */
  normalAmount: number;
  lastAmount: number;
  lastDate: string;
  /** Annualised cost at the current amount. */
  yearlyCost: number;
  /** Set when the latest charge broke from the established amount. */
  drift: { from: number; to: number; pct: number } | null;
  /** True when a recurring rule already covers this. */
  ruled: boolean;
  /** Days past due, when a charge was expected and never arrived. */
  overdueDays: number | null;
}

/** Three charges is the minimum that can show a rhythm; two is a coincidence. */
const MIN_CHARGES = 3;
/** Windows around a month and a year, wide enough for billing-date drift. */
const MONTHLY = [24, 38] as const;
const YEARLY = [330, 400] as const;
/** How close the amounts have to be for this to be one recurring charge. */
const AMOUNT_TOLERANCE = 0.2;
const CONSISTENT_SHARE = 0.7;
/** Below these the "price went up" claim is noise, not news. */
const DRIFT_MIN_PCT = 3;
const DRIFT_MIN_ABS = 0.5;

/**
 * Charges that repeat on their own, found in what is already logged.
 *
 * Two things worth money come out of this. The first is subscriptions nobody
 * declared as a rule and has stopped noticing — the gym from two years ago.
 * The second is **price drift**: the rule still says the rent is €900 while the
 * last three payments were €950. That gap is invisible in every chart, because
 * both numbers are individually plausible, and it is exactly the kind of thing
 * a ledger should be able to tell you without being asked.
 *
 * Grouped by note where there is one, since that is the closest thing to a
 * merchant in this model, and by category otherwise.
 */
export function detectSubscriptions(events: LedgerEvent[], now: Date = new Date()): DetectedSubscription[] {
  const groups = new Map<string, ExpenseEvent[]>();

  for (const e of events) {
    if (e.type !== 'expense') continue;
    const key = e.note?.trim() ? `note:${fold(e.note)}` : `cat:${fold(e.category)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  // A rule whose label or category matches means this is already declared, and
  // the point is to surface what is *not*.
  const ruled = new Set<string>();
  for (const rule of foldRecurring(events, 'expense')) {
    ruled.add(`note:${fold(rule.label)}`);
    if (rule.category) ruled.add(`cat:${fold(rule.category)}`);
  }

  const found: DetectedSubscription[] = [];

  for (const [key, all] of groups) {
    const charges = [...all].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (charges.length < MIN_CHARGES) continue;

    const gaps: number[] = [];
    for (let i = 1; i < charges.length; i++) {
      gaps.push((new Date(charges[i].timestamp).getTime() - new Date(charges[i - 1].timestamp).getTime()) / 86_400_000);
    }
    const interval = median(gaps);

    const cadence: Cadence | null =
      interval >= MONTHLY[0] && interval <= MONTHLY[1]
        ? 'monthly'
        : interval >= YEARLY[0] && interval <= YEARLY[1]
          ? 'yearly'
          : null;
    if (!cadence) continue;

    // A category charged monthly is not a subscription unless the amount is
    // stable too — "Groceries" repeats reliably and costs something different
    // every time.
    const amounts = charges.map((c) => c.amount);
    const typical = median(amounts);
    if (typical <= 0) continue;
    const consistent = amounts.filter((a) => Math.abs(a - typical) / typical <= AMOUNT_TOLERANCE).length;
    if (consistent / amounts.length < CONSISTENT_SHARE) continue;

    const last = charges[charges.length - 1];
    const earlier = amounts.slice(0, -1);
    const normal = roundCents(median(earlier));
    const change = last.amount - normal;
    const pct = normal > 0 ? (change / normal) * 100 : 0;

    const daysSinceLast = (now.getTime() - new Date(last.timestamp).getTime()) / 86_400_000;
    // Half a cycle late is the point at which "not billed yet" becomes
    // "cancelled, or you forgot to log it".
    const overdue = daysSinceLast - interval;

    found.push({
      key,
      label: last.note?.trim() || last.category,
      category: last.category,
      charges,
      cadence,
      intervalDays: Math.round(interval),
      normalAmount: normal,
      lastAmount: last.amount,
      lastDate: last.timestamp,
      yearlyCost: roundCents(last.amount * (cadence === 'monthly' ? 12 : 1)),
      drift:
        Math.abs(pct) >= DRIFT_MIN_PCT && Math.abs(change) >= DRIFT_MIN_ABS
          ? { from: normal, to: last.amount, pct: Math.round(pct * 10) / 10 }
          : null,
      ruled: ruled.has(key) || charges.some((c) => c.recurringId),
      overdueDays: overdue > interval * 0.5 ? Math.round(overdue) : null,
    });
  }

  // Costliest first: that is the order in which they are worth acting on.
  return found.sort((a, b) => b.yearlyCost - a.yearlyCost);
}

/** Total annual cost of everything detected — the number that makes the case
 * for reading the list. */
export function subscriptionTotal(subs: DetectedSubscription[]): number {
  return roundCents(subs.reduce((sum, s) => sum + s.yearlyCost, 0));
}
