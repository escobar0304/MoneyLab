import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LedgerEvent, ID, Recurring, RecurringKind, MoneyEvent, Holding, ForeignAmount, Goal, Debt, Account, Rule, TransferEvent, SpendChallenge, Vehicle } from './types';
import { makeId } from './id';
import {
  foldRecurring,
  foldCategories,
  foldBudgets,
  foldHoldings,
  foldPostedMonths,
  foldSkips,
  foldCleared,
  foldWorthIt,
  renameCategoryIn,
  recurringIdOf,
} from './entities';
import { foldAccounts, accountBalances, foldTransfers, validateTransfer, MAIN_ACCOUNT_ID } from '../money/accounts';
import { foldRules, applyRules, ruleChanges } from '../money/rules';
import { rowsToEvents, type StatementRow } from '../money/statements';
import type { Drill } from '../insight/drill';
import { foldGoals } from '../planning/goals';
import { foldDebts } from '../planning/debt';
import { foldChallenges } from '../planning/challenges';
import { foldVehicles } from '../tax/vehicles';
import { foldTrades, foldDividends, positionsFrom, investmentSummary, type Position, type InvestmentSummary } from '../investments/investments';
import { fetchConvertedQuotes, type ConvertedQuote } from '../investments/quotes';
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

/** What actually lands in localStorage — everything else on the state is
 * either derived or session-only. */
interface PersistedShape {
  events?: LedgerEvent[];
  lastExportedAt?: string | null;
  lastBackupAt?: string | null;
}

/** Fields an entry can be corrected to. Amount and date apply to both kinds. */
export type EntryPatch = Partial<{
  amount: number;
  date: string;
  label: string;
  category: string;
  subcategory: string;
  note: string;
  accountId: string;
}>;

interface MoneyLabState {
  events: LedgerEvent[];
  /** ISO timestamp of the last manual export, or null if never backed up. */
  lastExportedAt: string | null;
  /** ISO timestamp of the last automatic write to the backup folder. Tracked
   * separately from the manual export so the nag can go quiet once backups are
   * happening on their own. */
  lastBackupAt: string | null;
  undoSnapshot: UndoSnapshot | null;

  addIncome: (input: { amount: number; label: string; recurringId?: ID; date?: string; foreign?: ForeignAmount; accountId?: ID }) => void;
  addExpense: (input: {
    amount: number;
    category: string;
    subcategory?: string;
    note?: string;
    date?: string;
    foreign?: ForeignAmount;
    accountId?: ID;
    vehicleId?: ID;
    installmentIndex?: number;
    splitId?: ID;
    splitIndex?: number;
    splitCount?: number;
  }) => void;

  upsertAccount: (account: Omit<Account, 'id'> & { id?: ID }) => void;
  /** Sweeps whatever is left back to Main before closing the account, so no
   * money is stranded in a pot that no longer exists. */
  removeAccount: (id: ID) => void;
  /** Returns null on success, or why the transfer was refused. */
  transfer: (input: { fromAccountId: ID; toAccountId: ID; amount: number; note?: string; date?: string }) => string | null;

  /** Appends a parsed bank statement, rules applied. Returns how many landed. */
  importStatement: (rows: StatementRow[], options: { accountId?: ID; defaultCategory: string }) => number;

  upsertRule: (rule: Omit<Rule, 'id'> & { id?: ID }) => void;
  removeRule: (id: ID) => void;
  /** Runs every active rule over the whole ledger. Returns how many entries changed. */
  applyRulesToExisting: () => number;

  upsertRecurring: (rule: Omit<Recurring, 'id' | 'cycle'> & { id?: ID }) => void;
  removeRecurring: (id: ID) => void;
  runRecurring: () => void;

  setBudget: (category: string, amount: number) => void;
  clearBudget: (category: string) => void;

  upsertHolding: (holding: Omit<Holding, 'id'> & { id?: ID }) => void;
  removeHolding: (id: ID) => void;
  addTrade: (input: { holdingId: ID; side: 'buy' | 'sell'; quantity: number; price: number; fees?: number; date?: string }) => void;
  addDividend: (input: { holdingId: ID; amount: number; date?: string; alsoLogAsIncome?: boolean; label?: string }) => void;
  removeInvestmentEvent: (id: ID) => void;

  upsertGoal: (goal: Omit<Goal, 'id'> & { id?: ID }) => void;
  removeGoal: (id: ID) => void;
  contributeToGoal: (goalId: ID, amount: number, date?: string) => void;

  upsertDebt: (debt: Omit<Debt, 'id'> & { id?: ID }) => void;
  removeDebt: (id: ID) => void;

  upsertChallenge: (challenge: Omit<SpendChallenge, 'id'> & { id?: ID }) => void;
  removeChallenge: (id: ID) => void;

  upsertVehicle: (vehicle: Omit<Vehicle, 'id'> & { id?: ID }) => void;
  removeVehicle: (id: ID) => void;

  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  /** Renames a category, or merges it into `to` when that already exists. */
  renameCategory: (from: string, to: string) => void;

  setCleared: (entryId: ID, cleared: boolean) => void;
  setManyCleared: (entryIds: ID[], cleared: boolean) => void;
  setWorthIt: (entryId: ID, worthIt: boolean) => void;
  recategorizeMany: (entryIds: ID[], category: string) => void;
  removeMany: (entryIds: ID[]) => void;

  mapDeduction: (category: string, ruleId: string | null) => void;
  setDeductionCap: (ruleId: string, cap: number) => void;

  /**
   * Date the read-only views are rendered as of, or null for now. Session-only:
   * a persisted one would silently show a stale dashboard on the next visit
   * with no memory of having set it.
   */
  asOf: string | null;
  setAsOf: (date: string | null) => void;

  /**
   * The chart mark currently opened out into its underlying entries, or null.
   *
   * Session-only, and on the store rather than local to a page: any chart on any
   * view can open one, and a single owner is what keeps two marks from opening
   * two overlapping panels.
   */
  drill: Drill | null;
  openDrill: (drill: Drill) => void;
  closeDrill: () => void;

  /**
   * Live prices by symbol. Session-only and deliberately never written to the
   * ledger: appending an event per refresh would add a thousand entries a day
   * to an append-only log, to record something that is stale a minute later.
   */
  quotes: Record<string, ConvertedQuote>;
  quoteStatus: { loading: boolean; error: string | null; lastFetchedAt: string | null };
  /**
   * Fetches prices for everything held. Lives on the store rather than in a
   * hook so any panel can trigger a refresh, while only one scheduler decides
   * when it happens on its own.
   */
  refreshQuotes: () => Promise<void>;

  updateEntry: (id: ID, patch: EntryPatch) => void;
  removeEntry: (id: ID) => void;

  undo: () => void;
  dismissUndo: () => void;

  importEvents: (events: LedgerEvent[], mode: 'merge' | 'replace') => { added: number; duplicates: number };
  markExported: () => void;
  markBackedUp: () => void;
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
        lastBackupAt: null,
        undoSnapshot: null,
        asOf: null,
        drill: null,
        quotes: {},
        quoteStatus: { loading: false, error: null, lastFetchedAt: null },

        addIncome: ({ amount, label, recurringId, date, foreign, accountId }) => {
          const event: MoneyEvent = {
            id: makeId(),
            type: 'income',
            timestamp: date ?? new Date().toISOString(),
            amount,
            label,
            recurringId,
            foreign,
            accountId,
          };
          // Rules file the entry on the way in, so the form stays about what
          // happened rather than about where it should be put.
          set((s) => ({ events: [...s.events, applyRules(event, foldRules(s.events))] }));
        },

        addExpense: ({ amount, category, subcategory, note, date, foreign, accountId, vehicleId, installmentIndex, splitId, splitIndex, splitCount }) => {
          const event: MoneyEvent = {
            id: makeId(),
            type: 'expense',
            timestamp: date ?? new Date().toISOString(),
            amount,
            category,
            subcategory,
            note,
            foreign,
            accountId,
            vehicleId,
            installmentIndex,
            splitId,
            splitIndex,
            splitCount,
          };
          set((s) => ({ events: [...s.events, applyRules(event, foldRules(s.events))] }));
        },

        upsertAccount: (input) => {
          const clean = input.label.trim();
          if (!clean) return;
          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'account_upsert',
                timestamp: new Date().toISOString(),
                account: { ...input, label: clean, id: input.id ?? makeId() },
              },
            ],
          }));
        },

        removeAccount: (id) => {
          if (id === MAIN_ACCOUNT_ID) return;
          const events = get().events;
          const accounts = foldAccounts(events);
          const account = accounts.find((a) => a.id === id);
          if (!account) return;

          snapshot(`Account “${account.label}” closed`);
          const timestamp = new Date().toISOString();
          const left = accountBalances(events, accounts).get(id) ?? 0;
          const extra: LedgerEvent[] = [];

          // Closing a pot must not destroy what is in it. The sweep is a real
          // transfer, recorded like any other, so the account history reads
          // "moved back to Main" rather than the money simply reappearing there.
          if (Math.abs(left) >= 0.005) {
            extra.push({
              id: makeId(),
              type: 'transfer',
              timestamp,
              fromAccountId: left > 0 ? id : MAIN_ACCOUNT_ID,
              toAccountId: left > 0 ? MAIN_ACCOUNT_ID : id,
              amount: Math.abs(left),
              note: `Closing ${account.label}`,
            });
          }
          extra.push({ id: makeId(), type: 'account_remove', timestamp, accountId: id });
          set((s) => ({ events: [...s.events, ...extra] }));
        },

        transfer: ({ fromAccountId, toAccountId, amount, note, date }) => {
          const events = get().events;
          const accounts = foldAccounts(events);
          const problem = validateTransfer({ fromAccountId, toAccountId, amount }, accounts, accountBalances(events, accounts));
          if (problem) return problem.message;

          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'transfer',
                timestamp: date ?? new Date().toISOString(),
                fromAccountId,
                toAccountId,
                amount: Math.round(amount * 100) / 100,
                ...(note?.trim() ? { note: note.trim() } : {}),
              },
            ],
          }));
          return null;
        },

        importStatement: (rows, { accountId, defaultCategory }) => {
          if (rows.length === 0) return 0;
          const events = get().events;
          const built = rowsToEvents(rows, { accountId, defaultCategory, rules: foldRules(events) });

          // One snapshot for the whole file: an import is a single decision, and
          // undoing it one entry at a time is not an undo.
          snapshot(`${built.length} ${built.length === 1 ? 'entry' : 'entries'} imported`);
          set((s) => ({ events: [...s.events, ...built] }));
          return built.length;
        },

        upsertRule: (input) => {
          const clean = input.label.trim();
          if (!clean) return;
          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'rule_upsert',
                timestamp: new Date().toISOString(),
                rule: { ...input, label: clean, id: input.id ?? makeId() },
              },
            ],
          }));
        },

        removeRule: (id) => {
          snapshot('Rule removed');
          set((s) => ({ events: [...s.events, { id: makeId(), type: 'rule_remove', timestamp: new Date().toISOString(), ruleId: id }] }));
        },

        applyRulesToExisting: () => {
          const events = get().events;
          const accounts = foldAccounts(events);
          const label = (id: ID) => accounts.find((a) => a.id === id)?.label ?? id;
          const changes = ruleChanges(events, foldRules(events), label);
          if (changes.length === 0) return 0;

          snapshot(`${changes.length} ${changes.length === 1 ? 'entry' : 'entries'} refiled by rules`);
          const next = new Map(changes.map((c) => [c.entry.id, c.next]));
          set((s) => ({ events: s.events.map((e) => next.get(e.id) ?? e) }));
          return changes.length;
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

        addTrade: ({ holdingId, side, quantity, price, fees, date }) => {
          const events = get().events;
          const extra: LedgerEvent[] = [];
          const timestamp = date ?? new Date().toISOString();

          // A holding entered by hand carries its position on the record. The
          // first trade switches it to the trade log, and without seeding that
          // starting position here the units already owned would simply vanish
          // the moment a second purchase was logged.
          const alreadyTraded = events.some((e) => e.type === 'trade' && e.holdingId === holdingId);
          const holding = foldHoldings(events).find((h) => h.id === holdingId);
          if (!alreadyTraded && holding && holding.quantity > 0) {
            const opened = events.find((e) => e.type === 'holding_upsert' && e.holding.id === holdingId);
            // The opening position must sort *before* whatever is being logged
            // now. The holding record is stamped with the wall clock, while a
            // trade dated from the date field is midnight — so on the day the
            // holding is created, its own opening trade would otherwise sort
            // after a same-day sale, which then applies to a position that has
            // not been opened yet and is silently discarded.
            const openedAt = opened?.timestamp ?? timestamp;
            extra.push({
              id: makeId(),
              type: 'trade',
              timestamp: openedAt < timestamp ? openedAt : new Date(new Date(timestamp).getTime() - 1000).toISOString(),
              holdingId,
              side: 'buy',
              quantity: holding.quantity,
              price: holding.avgCost,
            });
          }

          extra.push({
            id: makeId(),
            type: 'trade',
            timestamp,
            holdingId,
            side,
            quantity,
            price,
            ...(fees ? { fees } : {}),
          });

          set((s) => ({ events: [...s.events, ...extra] }));
        },

        addDividend: ({ holdingId, amount, date, alsoLogAsIncome, label }) => {
          const timestamp = date ?? new Date().toISOString();
          const extra: LedgerEvent[] = [
            { id: makeId(), type: 'dividend', timestamp, holdingId, amount },
          ];
          // Whether the cash actually landed somewhere spendable depends on the
          // broker — accumulating funds never pay out at all — so this is the
          // user's call rather than something inferred.
          if (alsoLogAsIncome) {
            extra.push({ id: makeId(), type: 'income', timestamp, amount, label: label ?? 'Dividend' });
          }
          set((s) => ({ events: [...s.events, ...extra] }));
        },

        removeInvestmentEvent: (id) => {
          const target = get().events.find((e) => e.id === id);
          if (!target || (target.type !== 'trade' && target.type !== 'dividend')) return;
          snapshot(target.type === 'trade' ? 'Trade deleted' : 'Dividend deleted');
          set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
        },

        upsertGoal: (input) =>
          set((s) => ({
            events: [
              ...s.events,
              { id: makeId(), type: 'goal_upsert', timestamp: new Date().toISOString(), goal: { ...input, id: input.id ?? makeId() } },
            ],
          })),

        removeGoal: (id) => {
          snapshot('Goal removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'goal_remove', timestamp: new Date().toISOString(), goalId: id }],
          }));
        },

        contributeToGoal: (goalId, amount, date) => {
          if (amount === 0) return;
          set((s) => ({
            events: [
              ...s.events,
              { id: makeId(), type: 'goal_contribution', timestamp: date ?? new Date().toISOString(), goalId, amount },
            ],
          }));
        },

        upsertDebt: (input) =>
          set((s) => ({
            events: [
              ...s.events,
              { id: makeId(), type: 'debt_upsert', timestamp: new Date().toISOString(), debt: { ...input, id: input.id ?? makeId() } },
            ],
          })),

        removeDebt: (id) => {
          snapshot('Debt removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'debt_remove', timestamp: new Date().toISOString(), debtId: id }],
          }));
        },

        upsertChallenge: (input) =>
          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'challenge_upsert',
                timestamp: new Date().toISOString(),
                challenge: { ...input, id: input.id ?? makeId() },
              },
            ],
          })),

        removeChallenge: (id) => {
          snapshot('Challenge removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'challenge_remove', timestamp: new Date().toISOString(), challengeId: id }],
          }));
        },

        upsertVehicle: (input) =>
          set((s) => ({
            events: [
              ...s.events,
              {
                id: makeId(),
                type: 'vehicle_upsert',
                timestamp: new Date().toISOString(),
                vehicle: { ...input, id: input.id ?? makeId() },
              },
            ],
          })),

        removeVehicle: (id) => {
          snapshot('Vehicle removed');
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'vehicle_remove', timestamp: new Date().toISOString(), vehicleId: id }],
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

        renameCategory: (from, to) => {
          const { events, merged } = renameCategoryIn(get().events, from, to);
          if (events === get().events) return; // no-op rename
          snapshot(merged ? `“${from}” merged into “${to.trim()}”` : `“${from}” renamed to “${to.trim()}”`);
          set({ events });
        },

        setCleared: (entryId, cleared) =>
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'entry_cleared', timestamp: new Date().toISOString(), entryId, cleared }],
          })),

        setWorthIt: (entryId, worthIt) =>
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'worth_it', timestamp: new Date().toISOString(), entryId, worthIt }],
          })),

        recategorizeMany: (entryIds, category) => {
          const clean = category.trim();
          if (!clean || entryIds.length === 0) return;
          const ids = new Set(entryIds);
          snapshot(`${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'} moved to “${clean}”`);
          set((s) => ({
            events: s.events.map((e) => (e.type === 'expense' && ids.has(e.id) ? { ...e, category: clean } : e)),
          }));
        },

        removeMany: (entryIds) => {
          if (entryIds.length === 0) return;
          const ids = new Set(entryIds);
          snapshot(`${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'} deleted`);

          // Generated entries need the same skip marker a single delete emits,
          // or the generator quietly restores them on the next load.
          const extra: LedgerEvent[] = [];
          for (const e of get().events) {
            if (!ids.has(e.id) || (e.type !== 'income' && e.type !== 'expense')) continue;
            const recurringId = recurringIdOf(e);
            if (recurringId) {
              extra.push({
                id: makeId(),
                type: 'recurring_skip',
                timestamp: new Date().toISOString(),
                recurringId,
                month: monthKey(e.timestamp),
              });
            }
          }
          set((s) => ({ events: [...s.events.filter((e) => !ids.has(e.id)), ...extra] }));
        },

        mapDeduction: (category, ruleId) =>
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'deduction_map', timestamp: new Date().toISOString(), category, ruleId }],
          })),

        setDeductionCap: (ruleId, cap) =>
          set((s) => ({
            events: [...s.events, { id: makeId(), type: 'deduction_cap', timestamp: new Date().toISOString(), ruleId, cap }],
          })),

        setAsOf: (date) => set({ asOf: date }),

        openDrill: (drill) => set({ drill }),
        closeDrill: () => set({ drill: null }),

        refreshQuotes: async () => {
          const symbols = foldHoldings(get().events).map((h) => h.symbol.toUpperCase());
          if (symbols.length === 0) return;

          set((s) => ({ quoteStatus: { ...s.quoteStatus, loading: true } }));
          try {
            const quotes = await fetchConvertedQuotes(symbols);
            set((s) => ({
              // Merged rather than replaced: a refresh that only answered for
              // some symbols must not blank the others back to their stale
              // recorded prices.
              quotes: { ...s.quotes, ...Object.fromEntries(quotes.map((q) => [q.symbol, q])) },
              quoteStatus: {
                loading: false,
                lastFetchedAt: new Date().toISOString(),
                // Answering for nothing is a real failure — most often the proxy
                // is absent, which is what plain static hosting looks like.
                error: quotes.length === 0 ? 'No prices came back for these symbols.' : null,
              },
            }));
          } catch {
            set((s) => ({
              quoteStatus: { ...s.quoteStatus, loading: false, error: 'Could not reach the price service.' },
            }));
          }
        },

        setManyCleared: (entryIds, cleared) => {
          if (entryIds.length === 0) return;
          // Reconciling a whole statement is one action to undo, not forty.
          snapshot(cleared ? `${entryIds.length} entries marked cleared` : `${entryIds.length} entries unmarked`);
          const timestamp = new Date().toISOString();
          set((s) => ({
            events: [
              ...s.events,
              ...entryIds.map((entryId): LedgerEvent => ({ id: makeId(), type: 'entry_cleared', timestamp, entryId, cleared })),
            ],
          }));
        },

        updateEntry: (id, patch) => {
          snapshot('Entry edited');
          set((s) => ({
            events: s.events.map((e) => {
              if (e.id !== id || (e.type !== 'income' && e.type !== 'expense')) return e;
              const next = { ...e } as MoneyEvent;
              if (patch.amount !== undefined) next.amount = patch.amount;
              if (patch.date !== undefined) next.timestamp = patch.date;
              // Main is the absence of the field, not a value it holds — so
              // moving an entry back to Main removes it rather than storing it.
              if (patch.accountId !== undefined) {
                next.accountId = patch.accountId === MAIN_ACCOUNT_ID ? undefined : patch.accountId;
              }
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

        markBackedUp: () => set({ lastBackupAt: new Date().toISOString() }),

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
      partialize: (state) => ({ events: state.events, lastExportedAt: state.lastExportedAt, lastBackupAt: state.lastBackupAt }),

      // Normalisation lives in `merge`, not only in `migrate`, because zustand
      // guards migrate with `typeof stored.version === "number"`. Ledgers written
      // before versioning have no `version` key at all, so migrate never fires
      // for exactly the installs that need it most. `merge` runs on every
      // rehydrate regardless, and normalizeEvents is idempotent, so this is
      // correct for versioned and unversioned blobs alike.
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as PersistedShape;
        return {
          ...current,
          ...state,
          events: normalizeEvents(state.events ?? []),
          lastExportedAt: state.lastExportedAt ?? null,
          lastBackupAt: state.lastBackupAt ?? null,
        };
      },

      // Kept for future numbered bumps; harmless alongside `merge` above.
      migrate: (persisted) => {
        const state = persisted as PersistedShape;
        return {
          ...state,
          events: normalizeEvents(state.events ?? []),
          lastExportedAt: state.lastExportedAt ?? null,
          lastBackupAt: state.lastBackupAt ?? null,
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

/**
 * The ledger as the read-only views should see it.
 *
 * With `asOf` set this is every event up to the end of that day, which is all
 * time travel needs to be: the ledger is append-only, so truncating it *is* the
 * state of the app on that date. Nothing has to be replayed or stored twice.
 */
export const useVisibleEvents = (): LedgerEvent[] => {
  const events = useStore((s) => s.events);
  const asOf = useStore((s) => s.asOf);
  return useMemo(() => {
    if (!asOf) return events;
    const cutoff = `${asOf}T23:59:59.999Z`;
    return events.filter((e) => e.timestamp <= cutoff);
  }, [events, asOf]);
};

export const useAccounts = (): Account[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldAccounts(events), [events]);
};

/**
 * How much sits in each pot, right now.
 *
 * Reads the live ledger rather than the time-travelled one on purpose: this is
 * what the transfer form validates against, and validating "can I move 200 out
 * of Savings" against last March's balance would refuse transfers that are
 * perfectly fine. Read-only surfaces that should follow time travel derive their
 * own from `useVisibleEvents`.
 */
export const useAccountBalances = (): Map<ID, number> => {
  const events = useStore((s) => s.events);
  const accounts = useAccounts();
  return useMemo(() => accountBalances(events, accounts), [events, accounts]);
};

export const useTransfers = (): TransferEvent[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldTransfers(events), [events]);
};

export const useRules = (): Rule[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldRules(events), [events]);
};

export const useCleared = (): Set<ID> => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldCleared(events), [events]);
};

export const useWorthIt = (): Map<ID, boolean> => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldWorthIt(events), [events]);
};

export const useGoals = (): Goal[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldGoals(events), [events]);
};

export const useDebts = (): Debt[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldDebts(events), [events]);
};

export const useChallenges = (): SpendChallenge[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldChallenges(events), [events]);
};

export const useVehicles = (): Vehicle[] => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldVehicles(events), [events]);
};

/**
 * Holdings reconciled against their trade log.
 *
 * The single place the app asks "what do I own and what is it worth", so a
 * holding's quantity can never be read straight off the record while a trade
 * log exists that says otherwise.
 */
export const usePositions = (): Position[] => {
  const events = useStore((s) => s.events);
  const quotes = useStore((s) => s.quotes);
  // A live quote stands in for the recorded price, so value, unrealised gain
  // and IRR all follow without any of them knowing where it came from.
  return useMemo(() => positionsFrom(events, foldHoldings(events), quotes), [events, quotes]);
};

export interface Portfolio {
  positions: Position[];
  summary: InvestmentSummary;
  /** Today's move across everything priced live, or null when nothing is. */
  dayChange: number | null;
  dayChangePct: number | null;
  /** True when at least one live price is on a venue delay. */
  delayed: boolean;
  liveCount: number;
}

/** Everything the portfolio panels need, derived once. */
export const usePortfolio = (): Portfolio => {
  const events = useStore((s) => s.events);
  const quotes = useStore((s) => s.quotes);
  const positions = usePositions();

  return useMemo(() => {
    const summary = investmentSummary(positions, foldTrades(events), foldDividends(events));

    let dayChange = 0;
    let liveCount = 0;
    let delayed = false;
    for (const p of positions) {
      const quote = quotes[p.holding.symbol.toUpperCase()];
      if (!quote) continue;
      liveCount++;
      delayed = delayed || quote.delayed;
      dayChange += p.quantity * quote.baseChangeAbs;
    }

    const rounded = Math.round(dayChange * 100) / 100;
    // Yesterday's close is today's value minus today's move — the denominator
    // the percentage actually belongs over.
    const previous = summary.value - rounded;

    return {
      positions,
      summary,
      dayChange: liveCount > 0 ? rounded : null,
      dayChangePct: liveCount > 0 && previous > 0 ? Math.round((rounded / previous) * 1000) / 10 : null,
      delayed,
      liveCount,
    };
  }, [positions, events, quotes]);
};
