import type { LedgerEvent, Bucket, AllocationTemplate, Subscription, ID } from './types';

/** Folds append-only bucket_upsert/bucket_archive events into current bucket state. */
export function foldBuckets(events: LedgerEvent[]): Bucket[] {
  const map = new Map<ID, Bucket>();
  for (const e of events) {
    if (e.type === 'bucket_upsert') map.set(e.bucket.id, e.bucket);
    else if (e.type === 'bucket_archive') {
      const existing = map.get(e.bucketId);
      if (existing) map.set(e.bucketId, { ...existing, archived: true });
    }
  }
  return Array.from(map.values());
}

export function foldTemplates(events: LedgerEvent[]): AllocationTemplate[] {
  const map = new Map<ID, AllocationTemplate>();
  for (const e of events) {
    if (e.type === 'template_upsert') map.set(e.template.id, e.template);
  }
  return Array.from(map.values());
}

/**
 * Folds subscription_upsert/subscription_cancel/subscription_charge events into
 * current subscription state. lastChargedDate always derives from the most recent
 * subscription_charge event rather than being stored redundantly on upsert.
 */
export function foldSubscriptions(events: LedgerEvent[]): Subscription[] {
  const map = new Map<ID, Subscription>();
  for (const e of events) {
    if (e.type === 'subscription_upsert') {
      const prevCharge = map.get(e.subscription.id)?.lastChargedDate;
      map.set(e.subscription.id, { ...e.subscription, lastChargedDate: prevCharge });
    } else if (e.type === 'subscription_cancel') {
      const existing = map.get(e.subscriptionId);
      if (existing) map.set(e.subscriptionId, { ...existing, cancelled: true });
    } else if (e.type === 'subscription_charge') {
      const existing = map.get(e.subscriptionId);
      if (existing) map.set(e.subscriptionId, { ...existing, lastChargedDate: e.timestamp });
    }
  }
  return Array.from(map.values());
}
