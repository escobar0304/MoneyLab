import { useMemo, useState } from 'react';
import { useStore, useAccounts, useVehicles } from '../../lib/store';
import { MAIN_ACCOUNT_ID } from '../../lib/accounts';
import { Button, Card, Input, Label, SectionTitle, Select } from '../ui/primitives';
import { todayInputValue, formatMoney, formatDate } from '../../lib/format';
import { CategoryPicker } from './CategoryPicker';
import { AmountField, type AmountValue } from './AmountField';
import { splitPayment } from '../../lib/splitPayment';
import { makeId } from '../../lib/id';
import type { LedgerEvent } from '../../lib/types';

/** Subcategories stay free text — they're detail, not a dimension the charts
 * group by, so a controlled vocabulary would be friction for no benefit. The
 * datalist still offers what you've used before. */
function useKnownSubcategories(events: LedgerEvent[]): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.type === 'expense' && e.subcategory) set.add(e.subcategory);
    }
    return Array.from(set).sort();
  }, [events]);
}

export function ExpenseEntryForm() {
  const events = useStore((s) => s.events);
  const addExpense = useStore((s) => s.addExpense);
  const accounts = useAccounts();
  const vehicles = useVehicles();
  const knownSubcategories = useKnownSubcategories(events);

  const [amount, setAmount] = useState('');
  const [resolved, setResolved] = useState<AmountValue | null>(null);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState(MAIN_ACCOUNT_ID);
  const [vehicleId, setVehicleId] = useState('');
  const [installmentIndex, setInstallmentIndex] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [splitMonths, setSplitMonths] = useState('');
  const [splitRate, setSplitRate] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const installmentOptions = selectedVehicle?.installments ?? [];

  const splitPreview = useMemo(
    () => (splitting && resolved ? splitPayment(resolved.base, Number(splitMonths), Number(splitRate) || 0, date) : []),
    [splitting, resolved, splitMonths, splitRate, date]
  );

  const canSubmit = resolved !== null && category.trim() !== '' && (!splitting || splitPreview.length > 0);

  const submit = () => {
    if (!resolved || category.trim() === '') return;
    if (splitting) {
      if (splitPreview.length === 0) return;
      const splitId = makeId();
      // The whole purchase's foreign-amount receipt doesn't split cleanly across
      // months, so each instalment is logged in base currency only.
      for (const inst of splitPreview) {
        addExpense({
          amount: inst.amount,
          category: category.trim(),
          subcategory: subcategory.trim() || undefined,
          note: note.trim() || undefined,
          date: inst.date,
          accountId: accountId === MAIN_ACCOUNT_ID ? undefined : accountId,
          splitId,
          splitIndex: inst.index,
          splitCount: inst.count,
        });
      }
    } else {
      addExpense({
        amount: resolved.base,
        foreign: resolved.foreign,
        category: category.trim(),
        subcategory: subcategory.trim() || undefined,
        note: note.trim() || undefined,
        date: new Date(date).toISOString(),
        // Left off entirely when it is the main account, so an expense on a
        // ledger with no accounts stays byte-for-byte what it always was.
        accountId: accountId === MAIN_ACCOUNT_ID ? undefined : accountId,
        vehicleId: vehicleId || undefined,
        installmentIndex: installmentIndex === '' ? undefined : Number(installmentIndex),
      });
    }
    setAmount('');
    setSubcategory('');
    setNote('');
    // Which vehicle this paid is specific to this one expense, unlike
    // category/date/account which usually repeat across a sitting.
    setVehicleId('');
    setInstallmentIndex('');
    setSplitting(false);
    setSplitMonths('');
    setSplitRate('');
    // Category, date and account deliberately persist: logging several expenses
    // in one sitting usually means the same day, and often the same category.
  };

  return (
    <Card>
      <SectionTitle>Log expense</SectionTitle>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AmountField
            id="expense-amount"
            amount={amount}
            onAmountChange={setAmount}
            date={date}
            onResolved={setResolved}
            onSubmit={submit}
          />
          <div>
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <CategoryPicker value={category} onChange={setCategory} />

        <div className="rounded-lg border border-hairline bg-surface-1 p-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <input
              type="checkbox"
              checked={splitting}
              onChange={(e) => setSplitting(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            Split into installments
          </label>

          {splitting && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="split-months">Months</Label>
                  <Input
                    id="split-months"
                    type="number"
                    min={2}
                    step={1}
                    value={splitMonths}
                    onChange={(e) => setSplitMonths(e.target.value)}
                    placeholder="12"
                  />
                </div>
                <div>
                  <Label htmlFor="split-rate">Annual interest rate % (optional)</Label>
                  <Input
                    id="split-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={splitRate}
                    onChange={(e) => setSplitRate(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              {/* Shown before saving, same as a loan's monthly payment in the
                  Debt tab — it's the number that says whether the month count
                  entered was the one intended. */}
              <p className="text-xs text-ink-muted">
                {splitPreview.length > 0 ? (
                  <>
                    {splitPreview.length} payments of{' '}
                    <span className="num-col font-medium text-ink-secondary">{formatMoney(splitPreview[0].amount)}</span>
                    {splitPreview[splitPreview.length - 1].amount !== splitPreview[0].amount && (
                      <>
                        {' '}
                        (last one <span className="num-col font-medium text-ink-secondary">{formatMoney(splitPreview[splitPreview.length - 1].amount)}</span>)
                      </>
                    )}
                    , starting {formatDate(splitPreview[0].date)}.
                  </>
                ) : (
                  'Enter an amount and how many months to split it over.'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Only once the balance is actually split. Until then the answer is
            always Main, and a field with one answer is friction. */}
        {accounts.length > 1 && (
          <div>
            <Label htmlFor="expense-account">Paid from</Label>
            <Select id="expense-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Only once there's a vehicle to tag it to, and not while splitting —
            a split purchase posts several entries, and only one could ever be
            "the" IUC payment. Tagging is what lets the Taxes tab tell this
            cycle's IUC is settled instead of still showing the due date after
            it's already been paid. */}
        {vehicles.length > 0 && !splitting && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-vehicle">Vehicle (IUC payment, optional)</Label>
              <Select
                id="expense-vehicle"
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setInstallmentIndex('');
                }}
              >
                <option value="">Not a vehicle payment</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </Select>
            </div>
            {installmentOptions.length > 1 && (
              <div>
                <Label htmlFor="expense-installment">Which payment</Label>
                <Select id="expense-installment" value={installmentIndex} onChange={(e) => setInstallmentIndex(e.target.value)}>
                  <option value="">Choose…</option>
                  {installmentOptions.map((inst, i) => (
                    <option key={i} value={i}>
                      Payment {i + 1} — {formatMoney(inst.amount)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="expense-subcategory">Subcategory (optional)</Label>
            <Input
              id="expense-subcategory"
              list="known-subcategories"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Produce"
            />
            <datalist id="known-subcategories">
              {knownSubcategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="expense-note">Note (optional)</Label>
            <Input
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Trader Joe's run"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {!canSubmit && <p className="text-xs text-ink-muted">Pick a category and enter an amount.</p>}
          <Button onClick={submit} disabled={!canSubmit}>
            Log expense
          </Button>
        </div>
      </div>
    </Card>
  );
}
