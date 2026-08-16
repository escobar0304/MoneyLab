import { describe, it, expect } from 'vitest';
import { foldRules, matchesRule, applyRules, ruleChanges, matchCount } from './rules';
import { MAIN_ACCOUNT_ID } from './accounts';
import type { ExpenseEvent, IncomeEvent, LedgerEvent, Rule } from './types';

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r1',
  label: 'Rule',
  active: true,
  appliesTo: 'expense',
  conditions: [{ field: 'text', op: 'contains', value: 'lidl' }],
  actions: { category: 'Groceries' },
  ...over,
});

const expense = (over: Partial<ExpenseEvent> = {}): ExpenseEvent => ({
  id: 'e1',
  type: 'expense',
  timestamp: '2026-03-04T10:00:00.000Z',
  amount: 42,
  category: 'Uncategorised',
  ...over,
});

const income = (over: Partial<IncomeEvent> = {}): IncomeEvent => ({
  id: 'i1',
  type: 'income',
  timestamp: '2026-03-01T10:00:00.000Z',
  amount: 2000,
  label: 'Salary',
  ...over,
});

const label = (id: string) => (id === MAIN_ACCOUNT_ID ? 'Main' : id);

describe('foldRules', () => {
  it('applies later upserts and drops removed rules', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'rule_upsert', timestamp: 't1', rule: rule({ id: 'a' }) },
      { id: '2', type: 'rule_upsert', timestamp: 't2', rule: rule({ id: 'b', label: 'Second' }) },
      { id: '3', type: 'rule_upsert', timestamp: 't3', rule: rule({ id: 'a', label: 'Renamed' }) },
      { id: '4', type: 'rule_remove', timestamp: 't4', ruleId: 'b' },
    ];
    const rules = foldRules(events);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: 'a', label: 'Renamed' });
  });

  it('keeps a rule in place when it is edited — order decides which rule wins', () => {
    const events: LedgerEvent[] = [
      { id: '1', type: 'rule_upsert', timestamp: 't1', rule: rule({ id: 'a' }) },
      { id: '2', type: 'rule_upsert', timestamp: 't2', rule: rule({ id: 'b' }) },
      { id: '3', type: 'rule_upsert', timestamp: 't3', rule: rule({ id: 'a', label: 'Edited' }) },
    ];
    expect(foldRules(events).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('matchesRule', () => {
  it('matches on note text, folding case and accents', () => {
    // The categories in this app are Portuguese; a rule typed without accents
    // has to find the entry that has them.
    const r = rule({ conditions: [{ field: 'text', op: 'contains', value: 'alimentacao' }] });
    expect(matchesRule(expense({ note: 'Alimentação semanal' }), r)).toBe(true);
  });

  it('ANDs its conditions, so adding one narrows', () => {
    const r = rule({
      conditions: [
        { field: 'text', op: 'contains', value: 'lidl' },
        { field: 'amount', op: 'gte', value: '50' },
      ],
    });
    expect(matchesRule(expense({ note: 'Lidl', amount: 60 }), r)).toBe(true);
    expect(matchesRule(expense({ note: 'Lidl', amount: 40 }), r)).toBe(false);
  });

  it('never matches with no conditions — an "always" rule is never what was meant', () => {
    expect(matchesRule(expense(), rule({ conditions: [] }))).toBe(false);
  });

  it('never matches on an empty search value', () => {
    expect(matchesRule(expense({ note: 'anything' }), rule({ conditions: [{ field: 'text', op: 'contains', value: '  ' }] }))).toBe(false);
  });

  it('ignores inactive rules', () => {
    expect(matchesRule(expense({ note: 'Lidl' }), rule({ active: false }))).toBe(false);
  });

  it('respects appliesTo', () => {
    const r = rule({ appliesTo: 'income', conditions: [{ field: 'text', op: 'contains', value: 'salary' }] });
    expect(matchesRule(income(), r)).toBe(true);
    expect(matchesRule(expense({ note: 'salary' }), r)).toBe(false);
  });

  it('tests income text against the label, not the category it does not have', () => {
    const r = rule({ appliesTo: 'any', conditions: [{ field: 'text', op: 'contains', value: 'freelance' }] });
    expect(matchesRule(income({ label: 'Freelance invoice' }), r)).toBe(true);
  });

  it('does not let an amount leak into a text match', () => {
    // "text contains 42" must not match because the entry happens to cost 42.
    const r = rule({ conditions: [{ field: 'text', op: 'contains', value: '42' }] });
    expect(matchesRule(expense({ amount: 42, note: 'coffee' }), r)).toBe(false);
  });

  it('compares amounts numerically, comma decimal included', () => {
    expect(matchesRule(expense({ amount: 12.5 }), rule({ conditions: [{ field: 'amount', op: 'lte', value: '12,50' }] }))).toBe(true);
    expect(matchesRule(expense({ amount: 12.51 }), rule({ conditions: [{ field: 'amount', op: 'lte', value: '12,50' }] }))).toBe(false);
  });

  it('matches a category exactly rather than loosely', () => {
    const r = rule({ conditions: [{ field: 'category', op: 'equals', value: 'Rent' }] });
    expect(matchesRule(expense({ category: 'Rent' }), r)).toBe(true);
    expect(matchesRule(expense({ category: 'Rental car' }), r)).toBe(false);
  });
});

describe('applyRules', () => {
  it('returns the identical object when nothing matches', () => {
    const e = expense({ note: 'Continente' });
    expect(applyRules(e, [rule()])).toBe(e);
  });

  it('sets the category a rule asks for', () => {
    expect(applyRules(expense({ note: 'Lidl' }), [rule()])).toMatchObject({ category: 'Groceries' });
  });

  it('routes an entry to another account', () => {
    const r = rule({ conditions: [{ field: 'text', op: 'contains', value: 'trading 212' }], actions: { accountId: 'inv' } });
    expect(applyRules(expense({ note: 'Trading 212 top-up' }), [r])).toMatchObject({ accountId: 'inv' });
  });

  it('routes income too', () => {
    const r = rule({ appliesTo: 'income', conditions: [{ field: 'text', op: 'contains', value: 'dividend' }], actions: { accountId: 'inv' } });
    expect(applyRules(income({ label: 'Dividend' }), [r])).toMatchObject({ type: 'income', accountId: 'inv' });
  });

  it('lets a later rule correct an earlier one', () => {
    const broad = rule({ id: 'a', conditions: [{ field: 'text', op: 'contains', value: 'shop' }], actions: { category: 'Shopping' } });
    const narrow = rule({ id: 'b', conditions: [{ field: 'text', op: 'contains', value: 'bike shop' }], actions: { category: 'Transport' } });
    expect(applyRules(expense({ note: 'Bike shop' }), [broad, narrow])).toMatchObject({ category: 'Transport' });
  });

  it('leaves fields a rule does not set alone rather than blanking them', () => {
    const r = rule({ actions: { accountId: 'inv' } });
    expect(applyRules(expense({ note: 'Lidl', category: 'Groceries', subcategory: 'Weekly' }), [r])).toMatchObject({
      category: 'Groceries',
      subcategory: 'Weekly',
    });
  });

  it('does not put an expense category on income', () => {
    const r = rule({ appliesTo: 'any', conditions: [{ field: 'text', op: 'contains', value: 'salary' }], actions: { category: 'Groceries' } });
    expect(applyRules(income(), [r])).not.toHaveProperty('category');
  });
});

describe('ruleChanges', () => {
  const events: LedgerEvent[] = [
    expense({ id: 'a', note: 'Lidl', category: 'Uncategorised' }),
    expense({ id: 'b', note: 'Lidl', category: 'Groceries' }), // already right
    expense({ id: 'c', note: 'Cinema' }),
    income({ id: 'd' }),
  ];

  it('reports only the entries a rule would actually change', () => {
    const changes = ruleChanges(events, [rule()], label);
    expect(changes.map((c) => c.entry.id)).toEqual(['a']);
    expect(changes[0].changes).toEqual(['Category Uncategorised → Groceries']);
  });

  it('describes an account move by name, not by id', () => {
    const r = rule({ conditions: [{ field: 'text', op: 'contains', value: 'lidl' }], actions: { accountId: 'inv' } });
    const changes = ruleChanges(events, [r], (id) => (id === 'inv' ? 'Investments' : 'Main'));
    expect(changes[0].changes).toEqual(['Account Main → Investments']);
  });

  it('finds nothing when no rule matches', () => {
    expect(ruleChanges(events, [rule({ conditions: [{ field: 'text', op: 'contains', value: 'zzz' }] })], label)).toEqual([]);
  });
});

describe('matchCount', () => {
  it('counts every entry a rule reaches, changed or not', () => {
    const events: LedgerEvent[] = [expense({ id: 'a', note: 'Lidl' }), expense({ id: 'b', note: 'Lidl', category: 'Groceries' }), expense({ id: 'c' })];
    expect(matchCount(events, rule())).toBe(2);
  });
});
