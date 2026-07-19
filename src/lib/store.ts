import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  LedgerEvent,
  AllocationRule,
  ID,
  NetWorthEntry,
  Bucket,
  Subscription,
  AllocationTemplate,
} from './types';
import { UNALLOCATED_BUCKET_ID } from './types';
import { allocate } from './allocation';
import { makeId } from './id';
import { foldBuckets, foldSubscriptions, foldTemplates } from './entities';
import { elapsedChargeDates } from './subscriptions';

interface MoneyLabState {
  events: LedgerEvent[];

  addIncome: (input: {
    amount: number;
    label: string;
    rules: AllocationRule[];
    templateId?: ID;
    date?: string;
  }) => void;
  addExpense: (input: {
    amount: number;
    bucketId: ID;
    category: string;
    subcategory?: string;
    note?: string;
    date?: string;
  }) => void;

  upsertBucket: (bucket: Omit<Bucket, 'id'> & { id?: ID }) => Bucket;
  archiveBucket: (bucketId: ID) => void;

  upsertTemplate: (template: Omit<AllocationTemplate, 'id' | 'createdAt'> & { id?: ID }) => void;

  upsertSubscription: (sub: Omit<Subscription, 'id'> & { id?: ID }) => void;
  cancelSubscription: (id: ID) => void;
  runSubscriptionSimulation: () => void;

  takeNetWorthSnapshot: (assets: NetWorthEntry[], liabilities: NetWorthEntry[]) => void;

  ensureDefaultBuckets: () => void;
  importEvents: (events: LedgerEvent[]) => void;
  clearAll: () => void;
}

export const useStore = create<MoneyLabState>()(
  persist(
    (set, get) => ({
      events: [],

      addIncome: ({ amount, label, rules, templateId, date }) => {
        const allocations = allocate(amount, rules);
        const event: LedgerEvent = {
          id: makeId(),
          type: 'income',
          timestamp: date ?? new Date().toISOString(),
          amount,
          label,
          templateId,
          allocations,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      addExpense: ({ amount, bucketId, category, subcategory, note, date }) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'expense',
          timestamp: date ?? new Date().toISOString(),
          amount,
          bucketId,
          category,
          subcategory,
          note,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      upsertBucket: (bucket) => {
        const full: Bucket = { ...bucket, id: bucket.id ?? makeId() };
        const event: LedgerEvent = {
          id: makeId(),
          type: 'bucket_upsert',
          timestamp: new Date().toISOString(),
          bucket: full,
        };
        set((s) => ({ events: [...s.events, event] }));
        return full;
      },

      archiveBucket: (bucketId) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'bucket_archive',
          timestamp: new Date().toISOString(),
          bucketId,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      upsertTemplate: (template) => {
        const full: AllocationTemplate = {
          id: template.id ?? makeId(),
          name: template.name,
          rules: template.rules,
          createdAt: new Date().toISOString(),
        };
        const event: LedgerEvent = {
          id: makeId(),
          type: 'template_upsert',
          timestamp: new Date().toISOString(),
          template: full,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      upsertSubscription: (sub) => {
        const full: Subscription = { ...sub, id: sub.id ?? makeId() };
        const event: LedgerEvent = {
          id: makeId(),
          type: 'subscription_upsert',
          timestamp: new Date().toISOString(),
          subscription: full,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      cancelSubscription: (id) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'subscription_cancel',
          timestamp: new Date().toISOString(),
          subscriptionId: id,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      runSubscriptionSimulation: () => {
        const events = get().events;
        const subs = foldSubscriptions(events).filter((s) => !s.cancelled);
        const now = new Date();
        const newEvents: LedgerEvent[] = [];
        for (const sub of subs) {
          for (const d of elapsedChargeDates(sub, now)) {
            newEvents.push({
              id: makeId(),
              type: 'subscription_charge',
              timestamp: d.toISOString(),
              subscriptionId: sub.id,
              amount: sub.amount,
              bucketId: sub.bucketId,
            });
          }
        }
        if (newEvents.length > 0) set((s) => ({ events: [...s.events, ...newEvents] }));
      },

      takeNetWorthSnapshot: (assets, liabilities) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'networth_snapshot',
          timestamp: new Date().toISOString(),
          assets,
          liabilities,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      ensureDefaultBuckets: () => {
        const buckets = foldBuckets(get().events);
        if (!buckets.some((b) => b.id === UNALLOCATED_BUCKET_ID)) {
          const event: LedgerEvent = {
            id: makeId(),
            type: 'bucket_upsert',
            timestamp: new Date().toISOString(),
            bucket: { id: UNALLOCATED_BUCKET_ID, name: 'Unallocated', parentId: null, kind: 'unallocated' },
          };
          set((s) => ({ events: [...s.events, event] }));
        }
      },

      importEvents: (events) => set({ events }),
      clearAll: () => set({ events: [] }),
    }),
    { name: 'moneylab-v1' }
  )
);

// Convenience selector hooks. Select the raw `events` array (a stable reference until
// it changes) and fold it in a useMemo — folding directly inside the zustand selector
// would return a new array identity on every call and loop useSyncExternalStore forever.
export const useBuckets = (): Bucket[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldBuckets(events), [events]);
};
export const useTemplates = (): AllocationTemplate[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldTemplates(events), [events]);
};
export const useSubscriptions = (): Subscription[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldSubscriptions(events), [events]);
};
