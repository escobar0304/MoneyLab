import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { Button, Card, Input, Label, SectionTitle } from '../ui/primitives';
import { todayInputValue } from '../../lib/format';
import { CategoryPicker } from './CategoryPicker';
import { AmountField, type AmountValue } from './AmountField';
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
  const knownSubcategories = useKnownSubcategories(events);

  const [amount, setAmount] = useState('');
  const [resolved, setResolved] = useState<AmountValue | null>(null);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');

  const canSubmit = resolved !== null && category.trim() !== '';

  const submit = () => {
    if (!resolved || category.trim() === '') return;
    addExpense({
      amount: resolved.base,
      foreign: resolved.foreign,
      category: category.trim(),
      subcategory: subcategory.trim() || undefined,
      note: note.trim() || undefined,
      date: new Date(date).toISOString(),
    });
    setAmount('');
    setSubcategory('');
    setNote('');
    // Category and date deliberately persist: logging several expenses in one
    // sitting usually means the same day, and often the same category.
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
