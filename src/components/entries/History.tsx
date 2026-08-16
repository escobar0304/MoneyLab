import { useEffect, useMemo, useState } from 'react';
import { useStore, useCleared, useAccounts } from '../../lib/store';
import { monthsWithActivity, monthKey, totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { searchEntries } from '../../lib/search';
import { reconcile } from '../../lib/entities';
import { accountIdOf, MAIN_ACCOUNT_ID } from '../../lib/accounts';
import { Card, EmptyState, SectionTitle, Select, Input, Button, Modal } from '../ui/primitives';
import { CategoryPicker } from './CategoryPicker';
import { formatMoney, monthLabel } from '../../lib/format';
import { categoryColorMap } from '../../lib/chartTheme';
import { listReceiptIds } from '../../lib/receipts';
import { isMoneyEvent } from '../../lib/types';
import { EntryRow } from './EntryList';
import { EntryDetail } from './EntryDetail';

/**
 * The full ledger, browsable by month and searchable across all of them.
 *
 * This replaces a "last 12 entries" list, which quietly hid everything older —
 * the data was always stored, but there was no way to reach it, so an earlier
 * month looked like it had been lost. Rows open a detail overlay rather than
 * trying to show everything inline, where notes and subcategories only ever got
 * truncated away.
 */
export function History() {
  const events = useStore((s) => s.events);
  const cleared = useCleared();
  const setManyCleared = useStore((s) => s.setManyCleared);
  const recategorizeMany = useStore((s) => s.recategorizeMany);
  const removeMany = useStore((s) => s.removeMany);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const currentMonth = monthKey(new Date().toISOString());
  const months = useMemo(() => {
    const active = monthsWithActivity(events);
    return (active.includes(currentMonth) ? active : [...active, currentMonth]).sort().reverse();
  }, [events, currentMonth]);

  const accounts = useAccounts();
  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [account, setAccount] = useState('all');
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankBalance, setBankBalance] = useState('');
  const [recategorising, setRecategorising] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [withReceipts, setWithReceipts] = useState<Set<string>>(new Set());

  // Only the ids, so the list can badge rows without decoding every image.
  useEffect(() => {
    listReceiptIds()
      .then(setWithReceipts)
      .catch(() => setWithReceipts(new Set()));
  }, [events, openId]);

  const searching = query.trim() !== '';

  // Searching leaves the month behind on purpose: the reason to search is that
  // you do not remember when it happened.
  const entries = useMemo(() => {
    const base = searching
      ? searchEntries(events, query)
      : events
          .filter(isMoneyEvent)
          .filter((e) => monthKey(e.timestamp) === month)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return base
      .filter((e) => filter === 'all' || e.type === filter)
      .filter((e) => account === 'all' || accountIdOf(e) === account);
  }, [events, month, filter, account, query, searching]);

  const income = totalIncomeForMonth(events, month);
  const spend = totalOutflowForMonth(events, month);
  const open = entries.find((e) => e.id === openId) ?? null;

  const shownIds = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  const balances = useMemo(() => reconcile(events, shownIds), [events, shownIds]);
  const bank = Number(bankBalance.replace(',', '.'));
  const difference = Number.isFinite(bank) && bankBalance.trim() !== '' ? Math.round((bank - balances.clearedBalance) * 100) / 100 : null;

  const selectedIds = useMemo(() => entries.filter((e) => selected.has(e.id)).map((e) => e.id), [entries, selected]);
  const selectedExpenses = useMemo(
    () => entries.filter((e) => selected.has(e.id) && e.type === 'expense').map((e) => e.id),
    [entries, selected]
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const done = () => {
    setSelected(new Set());
    setSelecting(false);
  };

  return (
    <Card>
      <SectionTitle
        action={
          <div className="w-44">
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Month"
              disabled={searching}
              title={searching ? 'Search covers every month' : undefined}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        History
      </SectionTitle>

      <div className="mb-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search every month — category, note, amount…"
          aria-label="Search entries"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-hairline bg-surface-0 p-0.5">
            {(['all', 'income', 'expense'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-200 ${
                  filter === f ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink-secondary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Offered only once the balance is actually split — a filter with one
              option is a control that cannot do anything. */}
          {accounts.length > 1 && (
            <div className="w-36">
              <Select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Account">
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <button
            type="button"
            onClick={() => (selecting ? done() : setSelecting(true))}
            aria-pressed={selecting}
            className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
              selecting ? 'border-accent/40 bg-accent/12 text-accent' : 'border-hairline text-ink-muted hover:border-border hover:text-ink-secondary'
            }`}
          >
            {selecting ? 'Done' : 'Select'}
          </button>
        </div>

        <p className="text-xs text-ink-muted">
          {searching ? (
            <>
              {entries.length} match{entries.length === 1 ? '' : 'es'} across all months
            </>
          ) : (
            <>
              <span className="num-col text-positive">+{formatMoney(income)}</span> ·{' '}
              <span className="num-col text-complement">−{formatMoney(spend)}</span> · {entries.length} entr
              {entries.length === 1 ? 'y' : 'ies'}
            </>
          )}
        </p>
      </div>

      {selecting && (
        <div className="mb-3 space-y-3 rounded-lg border border-hairline bg-surface-0 p-3">
          {/* Acting on a selection and reconciling are the same gesture — tick
              rows, then do something to them — so they share one mode rather
              than fighting over the checkbox column. */}
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-ink-secondary">
              {selectedIds.length === 0 ? 'Nothing selected' : `${selectedIds.length} selected`}
            </p>
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSelected(new Set(shownIds))} disabled={entries.length === 0}>
                Select all shown
              </Button>
              <Button variant="secondary" onClick={() => setManyCleared(selectedIds, true)} disabled={selectedIds.length === 0}>
                Mark cleared
              </Button>
              <Button variant="secondary" onClick={() => setManyCleared(selectedIds, false)} disabled={selectedIds.length === 0}>
                Unmark
              </Button>
              <Button variant="secondary" onClick={() => setRecategorising(true)} disabled={selectedExpenses.length === 0}>
                Recategorise
              </Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={selectedIds.length === 0}>
                Delete
              </Button>
            </span>
          </div>

          <p className="border-t border-hairline pt-3 text-xs text-ink-secondary">
            Tick off each entry against your statement. When the cleared figure matches the bank, nothing is missing.
          </p>
          <div className="mt-2.5 flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <p className="text-xs text-ink-muted">Cleared</p>
              <p className="num-col text-lg font-semibold text-ink">{formatMoney(balances.clearedBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Not yet</p>
              <p className="num-col text-sm text-ink-secondary">
                {formatMoney(balances.unclearedBalance)} · {balances.unclearedCount} left
              </p>
            </div>
            <div className="w-32">
              <label htmlFor="bank-balance" className="mb-1 block text-xs font-medium text-ink-muted">
                Bank says
              </label>
              <Input
                id="bank-balance"
                type="text"
                inputMode="decimal"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
                placeholder="0,00"
              />
            </div>
            {difference !== null && (
              // Zero is the whole point of the exercise, so it gets said plainly
              // rather than shown as a "0,00 €" the eye slides past.
              <p className={`pb-1.5 text-sm font-medium ${difference === 0 ? 'text-positive' : 'text-complement'}`}>
                {difference === 0 ? (
                  'Matches — nothing missing.'
                ) : (
                  <>
                    Off by <span className="num-col">{formatMoney(Math.abs(difference))}</span>
                    {difference > 0 ? ' — the bank has more than you logged.' : ' — you logged more than the bank has.'}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title={searching ? `Nothing matches “${query.trim()}”` : `Nothing logged in ${monthLabel(month)}`}
          description={searching ? 'Search covers category, subcategory, note, amount and date.' : undefined}
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              color={entry.type === 'expense' ? colors.get(entry.category) : undefined}
              hasReceipt={withReceipts.has(entry.id)}
              showDate={searching}
              accountLabel={
                accounts.length > 1 && account === 'all' && accountIdOf(entry) !== MAIN_ACCOUNT_ID
                  ? accounts.find((a) => a.id === accountIdOf(entry))?.label
                  : undefined
              }
              selecting={selecting}
              selected={selected.has(entry.id)}
              onSelect={() => toggle(entry.id)}
              cleared={cleared.has(entry.id)}
              onOpen={() => setOpenId(entry.id)}
            />
          ))}
        </ul>
      )}

      {recategorising && (
        <Modal title={`Move ${selectedExpenses.length} ${selectedExpenses.length === 1 ? 'entry' : 'entries'}`} onClose={() => setRecategorising(false)}>
          <p className="text-sm text-ink-secondary">
            Pick the category they should have. Income entries in the selection are left alone — they have no category.
          </p>
          <div className="mt-3">
            <CategoryPicker value={bulkCategory} onChange={setBulkCategory} id="bulk-category" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRecategorising(false)}>
              Cancel
            </Button>
            <Button
              disabled={!bulkCategory.trim()}
              onClick={() => {
                recategorizeMany(selectedExpenses, bulkCategory);
                setRecategorising(false);
                setBulkCategory('');
                done();
              }}
            >
              Move them
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'}?`} onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-ink-secondary">
            This removes them from the ledger. You can undo it immediately afterwards, but not once you leave the page.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                removeMany(selectedIds);
                setConfirmDelete(false);
                done();
              }}
            >
              Delete them
            </Button>
          </div>
        </Modal>
      )}

      {open && <EntryDetail entry={open} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
