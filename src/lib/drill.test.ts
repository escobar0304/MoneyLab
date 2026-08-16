import { describe, it, expect } from 'vitest';
import { selectEntries, drillTotals } from './drill';
import { MAIN_ACCOUNT_ID } from './accounts';
import type { LedgerEvent } from './types';

const events: LedgerEvent[] = [
  { id: 'a', type: 'expense', timestamp: '2026-03-04T10:00:00.000Z', amount: 40, category: 'Groceries' },
  { id: 'b', type: 'expense', timestamp: '2026-03-18T10:00:00.000Z', amount: 25, category: 'Groceries', accountId: 'sav' },
  { id: 'c', type: 'expense', timestamp: '2026-03-20T10:00:00.000Z', amount: 900, category: 'Rent' },
  { id: 'd', type: 'expense', timestamp: '2026-02-11T10:00:00.000Z', amount: 60, category: 'Groceries' },
  { id: 'e', type: 'income', timestamp: '2026-03-01T10:00:00.000Z', amount: 2000, label: 'Salary' },
  { id: 'f', type: 'transfer', timestamp: '2026-03-02T10:00:00.000Z', fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 'sav', amount: 300 },
  { id: 'g', type: 'budget_set', timestamp: '2026-03-01T10:00:00.000Z', category: 'Groceries', amount: 200 },
];

describe('selectEntries', () => {
  it('returns money events only — a transfer is neither income nor spending', () => {
    expect(selectEntries(events, {}).map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns newest first', () => {
    expect(selectEntries(events, { month: '2026-03' }).map((e) => e.id)).toEqual(['c', 'b', 'a', 'e']);
  });

  it('narrows by month', () => {
    expect(selectEntries(events, { month: '2026-02' }).map((e) => e.id)).toEqual(['d']);
  });

  it('narrows by category and month together, which is what a pie slice means', () => {
    expect(selectEntries(events, { month: '2026-03', category: 'Groceries' }).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('narrows by type', () => {
    expect(selectEntries(events, { month: '2026-03', type: 'income' }).map((e) => e.id)).toEqual(['e']);
  });

  it('takes several categories at once, for an "Other" bucket', () => {
    expect(selectEntries(events, { month: '2026-03', categories: ['Rent', 'Groceries'] }).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('never matches income when a category is asked for', () => {
    expect(selectEntries(events, { category: 'Groceries', type: undefined }).every((e) => e.type === 'expense')).toBe(true);
  });

  it('narrows by account, reading an absent accountId as main', () => {
    expect(selectEntries(events, { accountId: 'sav' }).map((e) => e.id)).toEqual(['b']);
    expect(selectEntries(events, { month: '2026-03', accountId: MAIN_ACCOUNT_ID }).map((e) => e.id)).toEqual(['c', 'a', 'e']);
  });

  it('takes an inclusive date range', () => {
    expect(selectEntries(events, { from: '2026-03-04', to: '2026-03-18' }).map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('drillTotals', () => {
  it('splits the slice into what came in and what went out', () => {
    expect(drillTotals(selectEntries(events, { month: '2026-03' }))).toEqual({ income: 2000, expense: 965, net: 1035, count: 4 });
  });

  it('is all zeroes on an empty slice', () => {
    expect(drillTotals([])).toEqual({ income: 0, expense: 0, net: 0, count: 0 });
  });
});
