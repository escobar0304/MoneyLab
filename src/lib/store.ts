import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LedgerEvent, ID, Recurring, RecurringKind, MoneyEvent, Holding, ForeignAmount } from './types';
import { makeId } from './id';
import { foldRecurring, foldCategories, foldBudgets, foldHoldings, foldPostedMonths, foldSkips, recurringIdOf } from './entities';
import { occurrencesUpTo } from './recurrence';
import { monthKey } from './derive';
import { LEDGER_VERSION, normalizeEvents, mergeEvents } from './migrations';

/** A one-deep snapshot taken before anything destructive, so every such action
 * is reversible instead of only being confirmable. */
export interface UndoSnapshot {
  events: LedgerEvent[];
  label: string;
  at: number;
}

/** Fields an entry can be corrected to. Amount and date apply to both kinds. */
export type EntryPatch = Partial<{
  amount: number;
  date: string;
  label: string;
  category: string;
  subcategory: string;
  note: string;
}>;

interface MoneyLabState {
  events: LedgerEvent[];
  /** ISO timestamp of the last export, or null if never backed up. */
  lastExportedAt: string | null;
  undoSnapshot: UndoSnapshot | null;

  addIncome: (input: { amount: number; label: string; recurringId?: ID; date?: string; foreign?: ForeignAmount }) => void;
  addExpense: (input: { amount: number; category: string; subcategory?: string; note?: string; date?: string; foreign?: ForeignAmount }) => void;

  upsertRecurring: (rule: Omit<Recurring, 'id' | 'cycle'> & { id?: ID }) => void;
  removeRecurring: (id: ID) => void;
  runRecurring: () => void;

  setBudget: (category: string, amount: number) => void;
  clearBudget: (category: string) => void;

  upsertHolding: (holding: Omit<Holding, 'id'> & { id?: ID }) => void;
  removeHolding: (id: ID) => void;

  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;

  updateEntry: (id: ID, patch: EntryPatch) => void;
  removeEntry: (id: ID) => void;

  undo: () => void;
  dismissUndo: () => void;

  importEvents: (events: LedgerEvent[], mode: 'merge' | 'replace') => { added: number; duplicates: number };
  markExported: () => void;
  clearAll: () => void;
}

export const useStore = create<MoneyLabState>()(
  persist(
    (set, get) => {
      /** Snapshot the ledger so the next action can be reversed. */
      const snapshot = (label: string) =>
        set((s) => ({ undoSnapshot: { events: s.events, label, at: Date.now() } }));

      return {
        events: [],
        lastExportedAt: null,
        undoSnapshot: null,

        addIncome: ({ amount, label, recurringId, date, foreign }) => {
          const event: LedgerEvent = {
            id: makeId(),
            type: 'income',
            timestamp: date ?? new Date().toISOString(),
            amount,
            label,
            recurringId,
            foreign,
          };
          set((s) => ({ events: [...s.events, event] }));
        },

        addExpense: ({ amount, category, subcategory, note, date, foreign }) => {
          const event: LedgerEvent = {
            id: makeId(),
            type: 'expense',
            timestamp: date ?? new Date().toISOString(),
            amount,
            category,
            subcategory,
            note,
            foreign,
          };
          set((s) => ({ events: [...s.events, event] }));
        },

        upsertRecurring: (input) => {
          const full: Recurring = { ...input, id: input.id ?? makeId(), cycle: 'monthly' };
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'recurring_upsert', timestamp: new Date().toISOString(), rule: full }],
          }));
          // Catch up straight away. Without this, a rule added with a past start
          // date posts nothing at all until the page is reloaded.
          get().runRecurring();
        },

        removeRecurring: (id) => {
          snapshot('Recurring rule removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'recurring_remove', timestamp: new Date().toISOString(), recurringId: id }],
          }));
        },

        setBudget: (category, amount) =>
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'budget_set', timestamp: new Date().toISOString(), category, amount }],
          })),

        clearBudget: (category) => {
          snapshot(`Budget for “${category}” removed`);
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'budget_clear', timestamp: new Date().toISOString(), category }],
          }));
        },

        upsertHolding: (input) =>
          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'holding_upsert',
                timestamp: new Date().toISOString(),
                holding: { ...input, id: input.id ?? makeId() },
              },
            ],
          })),

        removeHolding: (id) => {
          snapshot('Holding removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'holding_remove', timestamp: new Date().toISOString(), holdingId: id }],
          }));
        },

        runRecurring: () => {
          const events = get().events;
          const posted = foldPostedMonths(events);
          const skipped = foldSkips(events);
          const now = new Date();

          const generated: LedgerEvent[] = [];
          for (const rule of foldRecurring(events)) {
            if (!rule.active) continue;
            for (const date of occurrencesUpTo(rule, now)) {
              const key = `${rule.id}:${monthKey(date.toISOString())}`;
              if (posted.has(key) || skipped.has(key)) continue;
              posted.add(key); // guard within this same run too
              generated.push(
                rule.kind === 'income'
                  ? {
                      id: makeId(),
                      type: 'income',
                      timestamp: date.toISOString(),
                      amount: rule.amount,
                      label: rule.label,
                      recurringId: rule.id,
                    }
                  : {
                      id: makeId(),
                      type: 'expense',
                      timestamp: date.toISOString(),
                      amount: rule.amount,
                      category: rule.category ?? rule.label,
                      note: rule.label,
                      recurringId: rule.id,
                    }
              );
            }
          }
          if (generated.length > 0) set((s) => ({ events: [...s.events, ...generated] }));
        },

        addCategory: (name) => {
          const clean = name.trim();
          if (!clean) return;
          if (foldCategories(get().events).some((c) => c.toLowerCase() === clean.toLowerCase())) return;
          set((s) => ({ events: [...s.events, { id: makeId(), type: 'category_upsert', timestamp: new Date().toISOString(), name: clean }] }));
        },

        removeCategory: (name) => {
          snapshot(`Category “${name}” removed`);
          set((s) => ({ events: [...s.events, { id: makeId(), type: 'category_remove', timestamp: new Date().toISOString(), name }] }));
        },

        updateEntry: (id, patch) => {
          snapshot('Entry edited');
          set((s) => ({
            events: s.events.map((e) => {
              if (e.id !== id || (e.type !== 'income' && e.type !== 'expense')) return e;
              const next = { ...e } as MoneyEvent;
              if (patch.amount !== undefined) next.amount = patch.amount;
              if (patch.date !== undefined) next.timestamp = patch.date;
              if (next.type === 'income' && patch.label !== undefined) next.label = patch.label;
              if (next.type === 'expense') {
                if (patch.category !== undefined) next.category = patch.category;
                // Empty string clears an optional field rather than storing "".
                if (patch.subcategory !== undefined) next.subcategory = patch.subcategory || undefined;
                if (patch.note !== undefined) next.note = patch.note || undefined;
              }
              return next;
            }),
          }));
        },

        removeEntry: (id) => {
          const target = get().events.find((e) => e.id === id);
          if (!target || (target.type !== 'income' && target.type !== 'expense')) return;
          snapshot('Entry deleted');

          const extra: LedgerEvent[] = [];
          const recurringId = recurringIdOf(target);
          if (recurringId) {
            // Without this the generator would simply put the entry back on the
            // next load, making the delete look like it silently failed.
            extra.push({
              id: makeId(),
              type: 'recurring_skip',
              timestamp: new Date().toISOString(),
              recurringId,
              month: monthKey(target.timestamp),
            });
          }
          set((s) => ({ events: [...s.events.filter((e) => e.id !== id), ...extra] }));
        },

        undo: () => {
          const snap = get().undoSnapshot;
          if (!snap) return;
          set({ events: snap.events, undoSnapshot: null });
        },

        dismissUndo: () => set({ undoSnapshot: null }),

        importEvents: (incoming, mode) => {
          snapshot(mode === 'replace' ? 'Data replaced by import' : 'Data merged from import');
          if (mode === 'replace') {
            const merged = normalizeEvents(incoming);
            set({ events: merged });
            return { added: merged.length, duplicates: 0 };
          }
          const { merged, added, duplicates } = mergeEvents(get().events, incoming);
          set({ events: merged });
          return { added, duplicates };
        },

        markExported: () => set({ lastExportedAt: new Date().toISOString() }),

        clearAll: () => {
          snapshot('All data cleared');
          set({ events: [] });
        },
      };
    },
    {
      name: 'moneylab-v1',
      version: LEDGER_VERSION,
      // The undo snapshot is deliberately session-only: persisting it would
      // double the stored payload and offer to "undo" something from last week.
      partialize: (state) => ({ events: state.events, lastExportedAt: state.lastExportedAt }),

      // Normalisation lives in `merge`, not only in `migrate`, because zustand
      // guards migrate with `typeof stored.version === "number"`. Ledgers written
      // before versioning have no `version` key at all, so migrate never fires
      // for exactly the installs that need it most. `merge` runs on every
      // rehydrate regardless, and normalizeEvents is idempotent, so this is
      // correct for versioned and unversioned blobs alike.
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as { events?: LedgerEvent[]; lastExportedAt?: string | null };
        return {
          ...current,
          ...state,
          events: normalizeEvents(state.events ?? []),
          lastExportedAt: state.lastExportedAt ?? null,
        };
      },

      // Kept for future numbered bumps; harmless alongside `merge` above.
      migrate: (persisted) => {
        const state = persisted as { events?: LedgerEvent[]; lastExportedAt?: string | null };
        return {
          ...state,
          events: normalizeEvents(state.events ?? []),
          lastExportedAt: state.lastExportedAt ?? null,
        };
      },
    }
  )
);

export const useRecurring = (kind?: RecurringKind): Recurring[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldRecurring(events, kind), [events, kind]);
};

export const useHoldings = (): Holding[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldHoldings(events), [events]);
};

export const useBudgets = (): Map<string, number> => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldBudgets(events), [events]);
};

export const useCategories = (): string[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldCategories(events), [events]);
};
