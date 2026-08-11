import { describe, it, expect } from 'vitest';
import { matchesQuery, searchEntries } from './search';
import type { LedgerEvent, MoneyEvent } from './types';

const expense = (over: Partial<Extract<MoneyEvent, { type: 'expense' }>> = {}): MoneyEvent => ({
  id: 'x1',
  type: 'expense',
  timestamp: '2026-03-14T10:00:00.000Z',
  amount: 42.5,
  category: 'Alimentação',
  ...over,
});

const income = (over: Partial<Extract<MoneyEvent, { type: 'income' }>> = {}): MoneyEvent => ({
  id: 'i1',
  type: 'income',
  timestamp: '2026-03-01T10:00:00.000Z',
  amount: 1800,
  label: 'Salary',
  ...over,
});

describe('matchesQuery', () => {
  it('matches on category, note and subcategory', () => {
    const e = expense({ subcategory: 'Peixaria', note: 'Jantar de sexta' });
    expect(matchesQuery(e, 'aliment')).toBe(true);
    expect(matchesQuery(e, 'peixa')).toBe(true);
    expect(matchesQuery(e, 'jantar')).toBe(true);
    expect(matchesQuery(e, 'dentista')).toBe(false);
  });

  it('ignores accents in both directions', () => {
    // The categories in this app are Portuguese; a search that needs the accent
    // typed correctly fails on exactly the words that are hardest to type.
    expect(matchesQuery(expense(), 'alimentacao')).toBe(true);
    expect(matchesQuery(expense({ category: 'Alimentacao' }), 'alimentação')).toBe(true);
  });

  it('ignores case', () => {
    expect(matchesQuery(income(), 'SALARY')).toBe(true);
  });

  it('matches an amount with either decimal separator', () => {
    expect(matchesQuery(expense(), '42.5')).toBe(true);
    expect(matchesQuery(expense(), '42,5')).toBe(true);
  });

  it('matches the date', () => {
    expect(matchesQuery(expense(), '2026-03')).toBe(true);
  });

  it('narrows with every extra term rather than widening', () => {
    const e = expense({ note: 'Dentista consulta' });
    expect(matchesQuery(e, 'dentista consulta')).toBe(true);
    expect(matchesQuery(e, 'dentista raio-x')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(expense(), '   ')).toBe(true);
  });
});

describe('searchEntries', () => {
  const events: LedgerEvent[] = [
    expense({ id: 'a', timestamp: '2026-01-10T10:00:00.000Z', category: 'Saúde', note: 'Dentista' }),
    expense({ id: 'b', timestamp: '2026-07-10T10:00:00.000Z', category: 'Saúde', note: 'Dentista' }),
    expense({ id: 'c', timestamp: '2026-07-11T10:00:00.000Z', category: 'Alimentação' }),
    income({ id: 'd' }),
    { id: 'cat', type: 'category_upsert', timestamp: '2026-01-01T00:00:00.000Z', name: 'Saúde' },
  ];

  it('reaches across every month, newest first', () => {
    // The whole reason to search is not remembering when it happened.
    const hits = searchEntries(events, 'dentista');
    expect(hits.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('returns nothing for an empty query rather than the entire ledger', () => {
    expect(searchEntries(events, '  ')).toEqual([]);
  });

  it('ignores events that are not entries', () => {
    expect(searchEntries(events, 'saude').every((e) => e.type === 'expense')).toBe(true);
  });
});
