import type { Account, ID, LedgerEvent, TransferEvent } from '../core/types';

/**
 * The pot everything belongs to unless it says otherwise.
 *
 * A fixed id rather than "the first account created", because every entry
 * written before accounts existed has no `accountId` at all and has to resolve
 * to something stable. Making it a constant means the whole back catalogue lands
 * in Main without a migration touching a single stored event.
 */
export const MAIN_ACCOUNT_ID = 'main';

const DEFAULT_MAIN: Account = { id: MAIN_ACCOUNT_ID, label: 'Main', kind: 'main' };

/** Suggested pots offered on an empty account list — the two the split is
 * almost always for. */
export const SUGGESTED_ACCOUNTS: { label: string; kind: Account['kind'] }[] = [
  { label: 'Savings', kind: 'savings' },
  { label: 'Investments', kind: 'investment' },
];

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Current accounts, main first and always present.
 *
 * Main is synthesised rather than stored, so it exists on a ledger that has
 * never heard of accounts. An `account_upsert` carrying the main id overrides
 * the default, which is how renaming it works; `account_remove` cannot delete
 * it, because deleting the account every historical entry points at would strand
 * the entire balance.
 */
export function foldAccounts(events: LedgerEvent[]): Account[] {
  const byId = new Map<ID, Account>([[MAIN_ACCOUNT_ID, DEFAULT_MAIN]]);

  for (const e of events) {
    if (e.type === 'account_upsert') byId.set(e.account.id, { ...e.account });
    else if (e.type === 'account_remove' && e.accountId !== MAIN_ACCOUNT_ID) byId.delete(e.accountId);
  }

  const main = byId.get(MAIN_ACCOUNT_ID) ?? DEFAULT_MAIN;
  const rest = Array.from(byId.values())
    .filter((a) => a.id !== MAIN_ACCOUNT_ID)
    .sort((a, b) => a.label.localeCompare(b.label));

  return [main, ...rest];
}

/** Accounts worth offering in a picker: everything not archived. */
export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.archived || a.id === MAIN_ACCOUNT_ID);
}

/** The pot an entry belongs to, resolving the "no accountId means Main" rule in
 * exactly one place. */
export function accountIdOf(e: { accountId?: ID }): ID {
  return e.accountId ?? MAIN_ACCOUNT_ID;
}

/**
 * How much is sitting in each pot.
 *
 * Balances for accounts that no longer exist fold back into Main rather than
 * being dropped. That is not tidiness — it is the invariant: the sum of this map
 * must always equal `totalBalance(events)`, or the dashboard's headline figure
 * and the sum of its own parts would disagree, and there would be no way to tell
 * which one was wrong.
 */
export function accountBalances(events: LedgerEvent[], accounts: Account[], asOf?: string): Map<ID, number> {
  const known = new Set(accounts.map((a) => a.id));
  const cutoff = asOf ? new Date(asOf).getTime() : Infinity;
  const balances = new Map<ID, number>(accounts.map((a) => [a.id, 0]));

  const add = (id: ID, delta: number) => {
    const target = known.has(id) ? id : MAIN_ACCOUNT_ID;
    balances.set(target, (balances.get(target) ?? 0) + delta);
  };

  for (const e of events) {
    if (new Date(e.timestamp).getTime() > cutoff) continue;
    if (e.type === 'income') add(accountIdOf(e), e.amount);
    else if (e.type === 'expense') add(accountIdOf(e), -e.amount);
    else if (e.type === 'transfer') {
      add(e.fromAccountId, -e.amount);
      add(e.toAccountId, e.amount);
    }
  }

  for (const [id, value] of balances) balances.set(id, roundCents(value));
  return balances;
}

/** Transfers, newest first — the account ledger, since transfers deliberately
 * never appear in the entry history. */
export function foldTransfers(events: LedgerEvent[]): TransferEvent[] {
  return events
    .filter((e): e is TransferEvent => e.type === 'transfer')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface TransferProblem {
  reason: 'same-account' | 'not-positive' | 'unknown-account' | 'overdraws';
  message: string;
}

/**
 * Why a transfer cannot go through, or null when it can.
 *
 * Overdrawing a sub-account is refused rather than allowed to go negative. A pot
 * holding minus eighty is not a fact about your money — the bank balance is
 * unchanged either way — it is a bookkeeping error, and the only honest reading
 * is that the transfer was wrong.
 */
export function validateTransfer(
  input: { fromAccountId: ID; toAccountId: ID; amount: number },
  accounts: Account[],
  balances: Map<ID, number>
): TransferProblem | null {
  const { fromAccountId, toAccountId, amount } = input;
  if (fromAccountId === toAccountId) {
    return { reason: 'same-account', message: 'Pick two different accounts.' };
  }
  if (!(amount > 0)) {
    return { reason: 'not-positive', message: 'Enter an amount above zero.' };
  }
  const ids = new Set(accounts.map((a) => a.id));
  if (!ids.has(fromAccountId) || !ids.has(toAccountId)) {
    return { reason: 'unknown-account', message: 'One of those accounts no longer exists.' };
  }
  const available = balances.get(fromAccountId) ?? 0;
  if (roundCents(amount) > roundCents(available)) {
    return {
      reason: 'overdraws',
      message: `That account only holds ${available.toFixed(2)}.`,
    };
  }
  return null;
}
