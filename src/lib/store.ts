import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LedgerEvent, ID, Salary } from './types';
import { makeId } from './id';
import { foldSalary } from './entities';
import { elapsedChargeDates } from './recurrence';

interface MoneyLabState {
  events: LedgerEvent[];

  addIncome: (input: { amount: number; label: string; salaryId?: ID; date?: string }) => void;
  addExpense: (input: { amount: number; category: string; subcategory?: string; note?: string; date?: string }) => void;

  upsertSalary: (salary: Omit<Salary, 'id' | 'cycle'> & { id?: ID }) => void;
  runSalarySimulation: () => void;

  importEvents: (events: LedgerEvent[]) => void;
  clearAll: () => void;
}

export const useStore = create<MoneyLabState>()(
  persist(
    (set, get) => ({
      events: [],

      addIncome: ({ amount, label, salaryId, date }) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'income',
          timestamp: date ?? new Date().toISOString(),
          amount,
          label,
          salaryId,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      addExpense: ({ amount, category, subcategory, note, date }) => {
        const event: LedgerEvent = {
          id: makeId(),
          type: 'expense',
          timestamp: date ?? new Date().toISOString(),
          amount,
          category,
          subcategory,
          note,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      upsertSalary: (salary) => {
        const full: Salary = { ...salary, id: salary.id ?? makeId(), cycle: 'monthly' };
        const event: LedgerEvent = {
          id: makeId(),
          type: 'salary_upsert',
          timestamp: new Date().toISOString(),
          salary: full,
        };
        set((s) => ({ events: [...s.events, event] }));
      },

      runSalarySimulation: () => {
        const events = get().events;
        const salary = foldSalary(events);
        if (!salary) return;
        const dates = elapsedChargeDates(salary, new Date());
        const newEvents: LedgerEvent[] = dates.map((d) => ({
          id: makeId(),
          type: 'income',
          timestamp: d.toISOString(),
          amount: salary.amount,
          label: 'Monthly salary',
          salaryId: salary.id,
        }));
        if (newEvents.length > 0) set((s) => ({ events: [...s.events, ...newEvents] }));
      },

      importEvents: (events) => set({ events }),
      clearAll: () => set({ events: [] }),
    }),
    { name: 'moneylab-v1' }
  )
);

export const useSalary = (): Salary | undefined => {
  const events = useStore((s) => s.events);
  return useMemo(() => foldSalary(events), [events]);
};
