import { useMemo, useState } from 'react';
import { useStore, useAccounts, useAccountBalances, useTransfers } from '../../lib/core/store';
import { MAIN_ACCOUNT_ID, SUGGESTED_ACCOUNTS } from '../../lib/money/accounts';
import { stableColorMap } from '../../lib/insight/chartTheme';
import { formatMoney, formatDate, todayInputValue } from '../../lib/core/format';
import { Button, Card, Input, Label, Modal, SectionTitle, Select, SubsectionLabel } from '../ui/primitives';
import type { Account, AccountKind } from '../../lib/core/types';

const KINDS: { id: AccountKind; label: string }[] = [
  { id: 'savings', label: 'Savings' },
  { id: 'investment', label: 'Investments' },
  { id: 'other', label: 'Other' },
];

/**
 * Splitting one balance into pots, and moving money between them.
 *
 * The accounts here are yours, not the bank's — there is still exactly one real
 * balance underneath, and every transfer nets to zero against it. That is the
 * whole reason this can exist without any other figure in the app becoming a
 * lie: net worth, runway and the charts all keep reading the undivided total.
 */
export function AccountsManager() {
  const accounts = useAccounts();
  const balances = useAccountBalances();
  const transfers = useTransfers();
  const upsertAccount = useStore((s) => s.upsertAccount);
  const removeAccount = useStore((s) => s.removeAccount);
  const transfer = useStore((s) => s.transfer);

  const colors = useMemo(() => stableColorMap(accounts.map((a) => a.id)), [accounts]);
  const total = useMemo(() => Array.from(balances.values()).reduce((a, b) => a + b, 0), [balances]);

  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<Account | null>(null);

  const [from, setFrom] = useState(MAIN_ACCOUNT_ID);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const name = (id: string) => accounts.find((a) => a.id === id)?.label ?? 'Closed account';
  const only = accounts.length === 1;

  /** The line under an account's name, or nothing when there is nothing to add.
   * An account called "Savings" of kind Savings would otherwise say its own
   * name back to itself. */
  const subtitle = (a: Account): string | null => {
    if (a.id === MAIN_ACCOUNT_ID) return 'Everything not filed elsewhere';
    if (a.note) return a.note;
    const kind = KINDS.find((k) => k.id === a.kind)?.label;
    return kind && kind.toLowerCase() !== a.label.toLowerCase() ? kind : null;
  };

  const submitTransfer = () => {
    const value = Number(amount.replace(',', '.'));
    const problem = transfer({
      fromAccountId: from,
      toAccountId: to,
      amount: Number.isFinite(value) ? value : 0,
      note,
      date: new Date(date).toISOString(),
    });
    setError(problem);
    if (!problem) {
      setAmount('');
      setNote('');
    }
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="secondary" onClick={() => setCreating(true)}>New account</Button>}>Accounts</SectionTitle>

      {only ? (
        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="text-sm text-ink-secondary">Everything sits in one pot.</p>
          <p className="t-caption mt-1">
            Split it up to keep savings and investment money separate from what you actually spend. Nothing moves at the bank — the total
            stays exactly the same.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_ACCOUNTS.map((s) => (
              <Button key={s.label} variant="secondary" onClick={() => upsertAccount({ label: s.label, kind: s.kind })}>
                Add “{s.label}”
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* One stacked bar for the split, for the same reason the portfolio
              uses one: the widths *are* the shares, so it needs no axis and
              cannot collide with itself however long the names get. */}
          {total > 0 && (
            <div
              className="mb-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`Split: ${accounts
                .map((a) => `${a.label} ${Math.round(((balances.get(a.id) ?? 0) / total) * 100)}%`)
                .join(', ')}`}
            >
              {accounts.map((a) => {
                const share = Math.max(((balances.get(a.id) ?? 0) / total) * 100, 0);
                return share > 0 ? (
                  <span
                    key={a.id}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${share}%`, backgroundColor: colors.get(a.id) }}
                  />
                ) : null;
              })}
            </div>
          )}

          <ul className="divide-y divide-hairline">
            {accounts.map((a) => {
              const balance = balances.get(a.id) ?? 0;
              return (
                <li key={a.id} className="row-pad flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(a.id) }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{a.label}</span>
                      {subtitle(a) && <span className="t-caption block truncate">{subtitle(a)}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`num-col text-sm font-medium ${balance < 0 ? 'text-critical-text' : 'text-ink-secondary'}`}>
                      {formatMoney(balance)}
                    </span>
                    <Button variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.label}`}>
                      Edit
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-hairline pt-4">
            <SubsectionLabel>Move money</SubsectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="transfer-from">From</Label>
                <Select id="transfer-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {formatMoney(balances.get(a.id) ?? 0)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="transfer-to">To</Label>
                <Select id="transfer-to" value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">Pick an account…</option>
                  {accounts
                    .filter((a) => a.id !== from)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="transfer-amount">Amount</Label>
                <Input
                  id="transfer-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitTransfer()}
                  placeholder="200,00"
                />
              </div>
              <div>
                <Label htmlFor="transfer-date">Date</Label>
                <Input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="transfer-note">Note (optional)</Label>
              <Input
                id="transfer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTransfer()}
                placeholder="Monthly saving"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              {error && (
                <p role="alert" className="text-xs text-critical-text">
                  {error}
                </p>
              )}
              <Button onClick={submitTransfer} disabled={!to || amount.trim() === ''}>
                Move it
              </Button>
            </div>
          </div>

          {transfers.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-4">
              {/* Transfers deliberately never reach the entry history — nothing
                  was earned or spent — so this is the only place they are
                  readable, and without it they would be unauditable. */}
              <SubsectionLabel>Recent moves</SubsectionLabel>
              <ul className="divide-y divide-hairline">
                {transfers.slice(0, 6).map((t) => (
                  <li key={t.id} className="row-pad flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate text-ink-secondary">
                        {name(t.fromAccountId)} → {name(t.toAccountId)}
                      </span>
                      <span className="block truncate text-ink-muted">
                        {formatDate(t.timestamp)}
                        {t.note ? ` · ${t.note}` : ''}
                      </span>
                    </span>
                    <span className="num-col shrink-0 text-ink-secondary">{formatMoney(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {creating && <AccountForm onClose={() => setCreating(false)} onSave={(a) => upsertAccount(a)} />}

      {editing && (
        <AccountForm
          account={editing}
          onClose={() => setEditing(null)}
          onSave={(a) => upsertAccount({ ...a, id: editing.id })}
          onClosingRequest={editing.id === MAIN_ACCOUNT_ID ? undefined : () => setClosing(editing)}
        />
      )}

      {closing && (
        <Modal title={`Close “${closing.label}”?`} onClose={() => setClosing(null)}>
          <p className="text-sm text-ink-secondary">
            {(balances.get(closing.id) ?? 0) !== 0 ? (
              <>
                The <span className="num-col">{formatMoney(balances.get(closing.id) ?? 0)}</span> in it moves back to{' '}
                {name(MAIN_ACCOUNT_ID)} as a recorded transfer. Nothing is lost, and the entries filed here keep their history.
              </>
            ) : (
              <>It is empty, so nothing moves. The entries filed here keep their history.</>
            )}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                removeAccount(closing.id);
                setClosing(null);
                setEditing(null);
                if (from === closing.id) setFrom(MAIN_ACCOUNT_ID);
                if (to === closing.id) setTo('');
              }}
            >
              Close it
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function AccountForm({
  account,
  onClose,
  onSave,
  onClosingRequest,
}: {
  account?: Account;
  onClose: () => void;
  onSave: (account: Omit<Account, 'id'>) => void;
  onClosingRequest?: () => void;
}) {
  const [label, setLabel] = useState(account?.label ?? '');
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'savings');
  const [note, setNote] = useState(account?.note ?? '');
  const isMain = account?.id === MAIN_ACCOUNT_ID;

  const save = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), kind: isMain ? 'main' : kind, ...(note.trim() ? { note: note.trim() } : {}) });
    onClose();
  };

  return (
    <Modal title={account ? `Edit “${account.label}”` : 'New account'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label htmlFor="account-label">Name</Label>
          <Input
            id="account-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Savings"
            autoFocus
          />
        </div>
        {/* The main account's kind is not a choice — it is the pot everything
            without an account falls back to, and it has to stay that. */}
        {!isMain && (
          <div>
            <Label htmlFor="account-kind">Kind</Label>
            <Select id="account-kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="account-note">Note (optional)</Label>
          <Input
            id="account-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Emergency fund — six months of costs"
          />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {onClosingRequest ? (
            <Button variant="ghost" onClick={onClosingRequest}>
              Close account
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!label.trim()}>
              Save
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
