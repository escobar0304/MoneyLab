import type {
  LedgerEvent,
  Bucket,
  ID,
  NetWorthSnapshotEvent,
} from './types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function previousMonthKey(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 2, 1); // m is 1-indexed; -2 steps back one month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current balance per bucket, derived by folding income allocations (credit) against
 * expenses and subscription charges (debit). Pass `asOf` to compute a balance as of a
 * past point in time instead of now. */
export function bucketBalances(events: LedgerEvent[], asOf?: string): Record<ID, number> {
  const cutoff = asOf ? new Date(asOf).getTime() : Infinity;
  const balances: Record<ID, number> = {};
  const add = (id: ID, delta: number) => {
    balances[id] = roundCents((balances[id] ?? 0) + delta);
  };
  for (const e of events) {
    if (new Date(e.timestamp).getTime() > cutoff) continue;
    if (e.type === 'income') {
      for (const a of e.allocations) add(a.bucketId, a.amount);
    } else if (e.type === 'expense') {
      add(e.bucketId, -e.amount);
    } else if (e.type === 'subscription_charge') {
      add(e.bucketId, -e.amount);
    }
  }
  return balances;
}

function latestSnapshotAt(events: LedgerEvent[], asOf: number): NetWorthSnapshotEvent | undefined {
  let latest: NetWorthSnapshotEvent | undefined;
  for (const e of events) {
    if (e.type === 'networth_snapshot' && new Date(e.timestamp).getTime() <= asOf) {
      if (!latest || new Date(e.timestamp).getTime() >= new Date(latest.timestamp).getTime()) latest = e;
    }
  }
  return latest;
}

/** Net worth = manual assets (from latest snapshot) + live investment/savings bucket
 * balances - manual liabilities (from latest snapshot), evaluated as of `asOf`. */
export function netWorthAt(events: LedgerEvent[], buckets: Bucket[], asOf?: string): number {
  const cutoffTime = asOf ? new Date(asOf).getTime() : Date.now();
  const snapshot = latestSnapshotAt(events, cutoffTime);
  const manualAssets = snapshot ? snapshot.assets.reduce((s, a) => s + a.amount, 0) : 0;
  const manualLiabilities = snapshot ? snapshot.liabilities.reduce((s, a) => s + a.amount, 0) : 0;

  const balances = bucketBalances(events, asOf);
  const investedBucketIds = new Set(
    buckets.filter((b) => b.kind === 'investment' || b.kind === 'savings').map((b) => b.id)
  );
  const investedTotal = Object.entries(balances)
    .filter(([id]) => investedBucketIds.has(id))
    .reduce((s, [, v]) => s + v, 0);

  return roundCents(manualAssets + investedTotal - manualLiabilities);
}

export interface NetWorthPoint {
  timestamp: string;
  value: number;
}

/** One point per networth_snapshot event, each evaluated with live bucket balances as
 * of that snapshot's own timestamp. */
export function netWorthSeries(events: LedgerEvent[], buckets: Bucket[]): NetWorthPoint[] {
  const snapshots = events.filter((e): e is NetWorthSnapshotEvent => e.type === 'networth_snapshot');
  return snapshots
    .map((s) => s.timestamp)
    .sort()
    .map((timestamp) => ({ timestamp, value: netWorthAt(events, buckets, timestamp) }));
}

export function spendByCategoryForMonth(events: LedgerEvent[], month: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.type === 'expense' && monthKey(e.timestamp) === month) {
      out[e.category] = roundCents((out[e.category] ?? 0) + e.amount);
    }
  }
  return out;
}

export function totalSpendForMonth(events: LedgerEvent[], month: string): number {
  return Object.values(spendByCategoryForMonth(events, month)).reduce((s, v) => s + v, 0);
}

/** Sum of income allocations into a bucket within a given month — "what was allocated". */
export function allocatedToBucketForMonth(events: LedgerEvent[], bucketId: ID, month: string): number {
  let total = 0;
  for (const e of events) {
    if (e.type === 'income' && monthKey(e.timestamp) === month) {
      for (const a of e.allocations) if (a.bucketId === bucketId) total += a.amount;
    }
  }
  return roundCents(total);
}

/** Sum of expenses + subscription charges drawn from a bucket within a given month —
 * "what was actually spent". */
export function actualSpendFromBucketForMonth(events: LedgerEvent[], bucketId: ID, month: string): number {
  let total = 0;
  for (const e of events) {
    if (monthKey(e.timestamp) !== month) continue;
    if (e.type === 'expense' && e.bucketId === bucketId) total += e.amount;
    else if (e.type === 'subscription_charge' && e.bucketId === bucketId) total += e.amount;
  }
  return roundCents(total);
}

export interface BucketVariance {
  bucketId: ID;
  allocated: number;
  actual: number;
  variance: number; // allocated - actual; positive = underspent, negative = overspent
}

export function bucketVarianceForMonth(events: LedgerEvent[], buckets: Bucket[], month: string): BucketVariance[] {
  return buckets
    .filter((b) => !b.archived)
    .map((b) => {
      const allocated = allocatedToBucketForMonth(events, b.id, month);
      const actual = actualSpendFromBucketForMonth(events, b.id, month);
      return { bucketId: b.id, allocated, actual, variance: roundCents(allocated - actual) };
    });
}

/** Distinct months (YYYY-MM) that appear in the ledger, sorted ascending. */
export function monthsWithActivity(events: LedgerEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (e.type === 'income' || e.type === 'expense' || e.type === 'subscription_charge') {
      set.add(monthKey(e.timestamp));
    }
  }
  return Array.from(set).sort();
}
