import { describe, it, expect } from 'vitest';
import { foldAccounts, accountBalances, foldTransfers, validateTransfer, accountIdOf, MAIN_ACCOUNT_ID } from './accounts';
import { totalBalance, totalIncomeForMonth, totalOutflowForMonth, monthsWithActivity } from './derive';
import { forecastMonth, savingsRateSeries, findAnomalies } from './analysis';
import { projectRunway } from './runway';
import { selectEntries } from './drill';
import type { LedgerEvent } from './types';

const at = (day: string) => `2026-0${day}T10:00:00.000Z`;

const income = (id: string, amount: number, accountId?: string): LedgerEvent => ({
  id,
  type: 'income',
  timestamp: at('1-05'),
  amount,
  label: 'Salary',
  ...(accountId ? { accountId } : {}),
});

const expense = (id: string, amount: number, accountId?: string): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp: at('1-06'),
  amount,
  category: 'Groceries',
  ...(accountId ? { accountId } : {}),
});

const transfer = (id: string, from: string, to: string, amount: number): LedgerEvent => ({
  id,
  type: 'transfer',
  timestamp: at('1-07'),
  fromAccountId: from,
  toAccountId: to,
  amount,
});

const openAccount = (id: string, label: string, kind: 'savings' | 'investment' | 'other' = 'savings'): LedgerEvent => ({
  id: `acc-${id}`,
  type: 'account_upsert',
  timestamp: at('1-01'),
  account: { id, label, kind },
});

describe('foldAccounts', () => {
  it('always produces a main account, even on a ledger that predates accounts', () => {
    const accounts = foldAccounts([income('1', 1000)]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: MAIN_ACCOUNT_ID, kind: 'main', label: 'Main' });
  });

  it('lets main be renamed without it ceasing to be main', () => {
    const accounts = foldAccounts([
      { id: 'e1', type: 'account_upsert', timestamp: at('1-01'), account: { id: MAIN_ACCOUNT_ID, label: 'Current account', kind: 'main' } },
    ]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ id: MAIN_ACCOUNT_ID, label: 'Current account' });
  });

  it('refuses to remove main — every historical entry points at it', () => {
    const accounts = foldAccounts([{ id: 'e1', type: 'account_remove', timestamp: at('1-02'), accountId: MAIN_ACCOUNT_ID }]);
    expect(accounts.map((a) => a.id)).toEqual([MAIN_ACCOUNT_ID]);
  });

  it('keeps main first and sorts the rest by label', () => {
    const accounts = foldAccounts([openAccount('s', 'Savings'), openAccount('i', 'Investments', 'investment')]);
    expect(accounts.map((a) => a.label)).toEqual(['Main', 'Investments', 'Savings']);
  });

  it('drops removed accounts', () => {
    const accounts = foldAccounts([openAccount('s', 'Savings'), { id: 'r', type: 'account_remove', timestamp: at('1-09'), accountId: 's' }]);
    expect(accounts.map((a) => a.id)).toEqual([MAIN_ACCOUNT_ID]);
  });
});

describe('accountIdOf', () => {
  it('reads an absent accountId as main', () => {
    expect(accountIdOf({})).toBe(MAIN_ACCOUNT_ID);
    expect(accountIdOf({ accountId: 's' })).toBe('s');
  });
});

describe('accountBalances', () => {
  it('lands pre-accounts entries in main', () => {
    const events = [income('1', 1000), expense('2', 250)];
    expect(accountBalances(events, foldAccounts(events)).get(MAIN_ACCOUNT_ID)).toBe(750);
  });

  it('moves money between pots without changing the total', () => {
    const events = [openAccount('s', 'Savings'), income('1', 1000), transfer('2', MAIN_ACCOUNT_ID, 's', 300)];
    const balances = accountBalances(events, foldAccounts(events));
    expect(balances.get(MAIN_ACCOUNT_ID)).toBe(700);
    expect(balances.get('s')).toBe(300);
    // The whole point: a transfer is invisible to the headline figure.
    expect(totalBalance(events)).toBe(1000);
  });

  it('always sums to the single balance, whatever the split', () => {
    const events = [
      openAccount('s', 'Savings'),
      openAccount('i', 'Investments', 'investment'),
      income('1', 2500),
      income('2', 40, 's'),
      expense('3', 130),
      expense('4', 20, 's'),
      transfer('5', MAIN_ACCOUNT_ID, 's', 500),
      transfer('6', 's', 'i', 120.55),
    ];
    const sum = Array.from(accountBalances(events, foldAccounts(events)).values()).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(totalBalance(events));
  });

  it('folds an orphaned balance back into main rather than losing it', () => {
    // The account is gone but its entries still name it. Dropping them would
    // make the parts stop adding up to the whole.
    const events = [openAccount('s', 'Savings'), income('1', 900, 's'), { id: 'r', type: 'account_remove', timestamp: at('1-09'), accountId: 's' } as LedgerEvent];
    const balances = accountBalances(events, foldAccounts(events));
    expect(balances.get(MAIN_ACCOUNT_ID)).toBe(900);
    expect(Array.from(balances.values()).reduce((a, b) => a + b, 0)).toBe(totalBalance(events));
  });

  it('honours an as-of cutoff', () => {
    const events = [openAccount('s', 'Savings'), income('1', 1000), transfer('2', MAIN_ACCOUNT_ID, 's', 300)];
    const before = accountBalances(events, foldAccounts(events), at('1-06'));
    expect(before.get(MAIN_ACCOUNT_ID)).toBe(1000);
    expect(before.get('s')).toBe(0);
  });
});

/**
 * The load-bearing property of the whole feature.
 *
 * A transfer carries an `amount`, which makes it the one event shape that could
 * plausibly be mistaken for money moving in or out. Every derivation in the app
 * is asserted here rather than trusted, because the failure mode is silent: a
 * savings transfer counted as spending would inflate the month, drag the savings
 * rate down and shorten the runway, all without anything looking broken.
 */
describe('a transfer is neither income nor spending', () => {
  const month = '2026-01';
  const withTransfer: LedgerEvent[] = [
    openAccount('s', 'Savings'),
    { id: 'i', type: 'income', timestamp: `${month}-02T10:00:00.000Z`, amount: 2000, label: 'Salary' },
    { id: 'x', type: 'expense', timestamp: `${month}-06T10:00:00.000Z`, amount: 300, category: 'Groceries' },
    { id: 't', type: 'transfer', timestamp: `${month}-07T10:00:00.000Z`, fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 's', amount: 900 },
  ];
  const without = withTransfer.filter((e) => e.type !== 'transfer');
  const now = new Date(`${month}-20T10:00:00.000Z`);

  it('does not change the balance', () => {
    expect(totalBalance(withTransfer)).toBe(totalBalance(without));
  });

  it('does not count as income or outflow', () => {
    expect(totalIncomeForMonth(withTransfer, month)).toBe(2000);
    expect(totalOutflowForMonth(withTransfer, month)).toBe(300);
  });

  it('does not invent a month of activity', () => {
    expect(monthsWithActivity(withTransfer)).toEqual(monthsWithActivity(without));
  });

  it('does not move the forecast, the savings rate or the runway', () => {
    expect(forecastMonth(withTransfer, month, now)).toEqual(forecastMonth(without, month, now));
    expect(savingsRateSeries(withTransfer)).toEqual(savingsRateSeries(without));
    expect(projectRunway(withTransfer, { days: 60, now })).toEqual(projectRunway(without, { days: 60, now }));
  });

  it('is never flagged as an unusual charge', () => {
    expect(findAnomalies(withTransfer, month)).toEqual(findAnomalies(without, month));
  });

  it('never appears in a drilled slice', () => {
    expect(selectEntries(withTransfer, { month }).map((e) => e.id)).toEqual(['x', 'i']);
  });
});

describe('foldTransfers', () => {
  it('returns transfers newest first and nothing else', () => {
    const events = [income('1', 100), transfer('t1', MAIN_ACCOUNT_ID, 's', 10), { ...transfer('t2', MAIN_ACCOUNT_ID, 's', 20), timestamp: at('1-08') }];
    expect(foldTransfers(events).map((t) => t.id)).toEqual(['t2', 't1']);
  });
});

describe('validateTransfer', () => {
  const events = [openAccount('s', 'Savings'), income('1', 1000)];
  const accounts = foldAccounts(events);
  const balances = accountBalances(events, accounts);

  it('accepts a transfer the source can cover', () => {
    expect(validateTransfer({ fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 's', amount: 1000 }, accounts, balances)).toBeNull();
  });

  it('refuses a transfer into the same account', () => {
    expect(validateTransfer({ fromAccountId: 's', toAccountId: 's', amount: 10 }, accounts, balances)?.reason).toBe('same-account');
  });

  it('refuses zero and negative amounts', () => {
    expect(validateTransfer({ fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 's', amount: 0 }, accounts, balances)?.reason).toBe('not-positive');
    expect(validateTransfer({ fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 's', amount: -5 }, accounts, balances)?.reason).toBe('not-positive');
  });

  it('refuses an unknown account', () => {
    expect(validateTransfer({ fromAccountId: MAIN_ACCOUNT_ID, toAccountId: 'gone', amount: 5 }, accounts, balances)?.reason).toBe('unknown-account');
  });

  it('refuses to overdraw a pot', () => {
    // A pot at minus eighty is a bookkeeping error, not a fact about the money.
    expect(validateTransfer({ fromAccountId: 's', toAccountId: MAIN_ACCOUNT_ID, amount: 80 }, accounts, balances)?.reason).toBe('overdraws');
  });

  it('allows moving exactly the balance, cents included', () => {
    const e = [openAccount('s', 'Savings'), income('1', 10.1), income('2', 0.2, 's')];
    const a = foldAccounts(e);
    expect(validateTransfer({ fromAccountId: 's', toAccountId: MAIN_ACCOUNT_ID, amount: 0.2 }, a, accountBalances(e, a))).toBeNull();
  });
});
