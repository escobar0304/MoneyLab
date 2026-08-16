import { useState, type ReactNode } from 'react';
import { useStore, useCleared, useAccounts } from '../../lib/store';
import { accountIdOf } from '../../lib/accounts';
import { formatMoney, formatDate, formatDateTime } from '../../lib/format';
import { formatForeign } from '../../lib/currency';
import { categoryColorMap } from '../../lib/chartTheme';
import { Button, Input, Label, Modal, Select } from '../ui/primitives';
import { CategoryPicker } from './CategoryPicker';
import { ReceiptAttachment } from './ReceiptAttachment';
import type { MoneyEvent } from '../../lib/types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <dt className="shrink-0 text-xs text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink-secondary">{children}</dd>
    </div>
  );
}

/**
 * The whole of one entry, on demand.
 *
 * The list row can only carry a few characters before it starts truncating, so
 * subcategory, notes, the original foreign amount and the receipt were all
 * effectively write-only — typed once and never readable again. This is where
 * they become worth having recorded.
 */
export function EntryDetail({ entry, onClose }: { entry: MoneyEvent; onClose: () => void }) {
  const events = useStore((s) => s.events);
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const setCleared = useStore((s) => s.setCleared);
  const isCleared = useCleared().has(entry.id);
  const accounts = useAccounts();
  const colors = categoryColorMap(events);

  const isIncome = entry.type === 'income';
  const [editing, setEditing] = useState(false);
  const [accountId, setAccountId] = useState(accountIdOf(entry));
  const accountName = accounts.find((a) => a.id === accountIdOf(entry))?.label;

  const [amount, setAmount] = useState(String(entry.amount));
  const [date, setDate] = useState(entry.timestamp.slice(0, 10));
  const [label, setLabel] = useState(isIncome ? entry.label : '');
  const [category, setCategory] = useState(isIncome ? '' : entry.category);
  const [subcategory, setSubcategory] = useState(isIncome ? '' : (entry.subcategory ?? ''));
  const [note, setNote] = useState(isIncome ? '' : (entry.note ?? ''));

  const amountNum = Number(amount) || 0;
  const valid = amountNum > 0 && (isIncome ? label.trim() !== '' : category.trim() !== '');

  const save = () => {
    if (!valid) return;
    updateEntry(entry.id, {
      amount: amountNum,
      date: new Date(date).toISOString(),
      accountId,
      ...(isIncome ? { label: label.trim() } : { category: category.trim(), subcategory: subcategory.trim(), note: note.trim() }),
    });
    setEditing(false);
  };

  const title = isIncome ? entry.label : entry.category;

  return (
    <Modal title={title} onClose={onClose}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`d-amount-${entry.id}`}>Amount</Label>
              <Input
                id={`d-amount-${entry.id}`}
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor={`d-date-${entry.id}`}>Date</Label>
              <Input id={`d-date-${entry.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {accounts.length > 1 && (
            <div>
              <Label htmlFor={`d-account-${entry.id}`}>Account</Label>
              <Select id={`d-account-${entry.id}`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {isIncome ? (
            <div>
              <Label htmlFor={`d-label-${entry.id}`}>Label</Label>
              <Input id={`d-label-${entry.id}`} value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          ) : (
            <>
              <CategoryPicker value={category} onChange={setCategory} id={`d-cat-${entry.id}`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`d-sub-${entry.id}`}>Subcategory</Label>
                  <Input id={`d-sub-${entry.id}`} value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor={`d-note-${entry.id}`}>Note</Label>
                  <Input id={`d-note-${entry.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!valid}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className={`t-metric ${isIncome ? 'text-positive' : 'text-ink'}`}>
              {isIncome ? '+' : '−'}
              {formatMoney(entry.amount)}
            </span>
            {!isIncome && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors.get(entry.category) ?? 'var(--color-ink-muted)' }}
                aria-hidden="true"
              />
            )}
          </div>

          <dl>
            <Field label="Date">{formatDate(entry.timestamp)}</Field>

            {entry.foreign && (
              <>
                <Field label="Paid">{formatForeign(entry.foreign.originalAmount, entry.foreign.currency)}</Field>
                <Field label="Rate used">
                  <span className="num-col">
                    {entry.foreign.rate.toFixed(4)} €/{entry.foreign.currency}
                  </span>{' '}
                  <span className="text-ink-muted">on {entry.foreign.rateDate}</span>
                </Field>
              </>
            )}

            {isIncome ? (
              <Field label="Source">{entry.label}</Field>
            ) : (
              <>
                <Field label="Category">{entry.category}</Field>
                {entry.subcategory && <Field label="Subcategory">{entry.subcategory}</Field>}
                {entry.note && <Field label="Note">{entry.note}</Field>}
              </>
            )}

            {accounts.length > 1 && accountName && <Field label="Account">{accountName}</Field>}
            {accounts.length > 1 && !accountName && (
              // The account is gone but the entry still names it. Saying so is
              // better than silently showing Main, which is where the money in
              // fact counts.
              <Field label="Account">
                <span className="text-ink-muted">A closed account — counted in {accounts[0].label}</span>
              </Field>
            )}

            {entry.recurringId && (
              <Field label="Origin">
                <span className="text-ink-muted">Posted automatically by a recurring rule</span>
              </Field>
            )}

            <Field label="Recorded">
              <span className="text-ink-muted">{formatDateTime(entry.timestamp)}</span>
            </Field>

            <Field label="Cleared">
              <label className="flex cursor-pointer items-center justify-end gap-2">
                <input
                  type="checkbox"
                  checked={isCleared}
                  onChange={(e) => setCleared(entry.id, e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
                <span className={isCleared ? 'text-positive' : 'text-ink-muted'}>
                  {isCleared ? 'Checked against the bank' : 'Not verified yet'}
                </span>
              </label>
            </Field>
          </dl>

          {!isIncome && (
            <div className="mt-3 border-t border-hairline pt-3">
              <ReceiptAttachment expenseId={entry.id} />
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                removeEntry(entry.id);
                onClose();
              }}
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
