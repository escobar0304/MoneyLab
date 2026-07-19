import { useMemo, useState } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { Button, Card, EmptyState, Input, Label, Select, SectionTitle } from '../ui/primitives';
import { todayInputValue } from '../../lib/format';
import type { LedgerEvent } from '../../lib/types';

function useKnownValues(events: LedgerEvent[], field: 'category' | 'subcategory'): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.type === 'expense') {
        const v = field === 'category' ? e.category : e.subcategory;
        if (v) set.add(v);
      }
    }
    return Array.from(set).sort();
  }, [events, field]);
}

export function ExpenseEntryForm() {
  const buckets = useBuckets();
  const events = useStore((s) => s.events);
  const addExpense = useStore((s) => s.addExpense);
  const knownCategories = useKnownValues(events, 'category');
  const knownSubcategories = useKnownValues(events, 'subcategory');

  const active = buckets.filter((b) => !b.archived);
  const [amount, setAmount] = useState('');
  const [bucketId, setBucketId] = useState(active[0]?.id ?? '');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState('');

  const amountNum = Number(amount) || 0;

  const submit = () => {
    if (amountNum <= 0 || !bucketId || !category.trim()) return;
    addExpense({
      amount: amountNum,
      bucketId,
      category: category.trim(),
      subcategory: subcategory.trim() || undefined,
      note: note.trim() || undefined,
      date: new Date(date).toISOString(),
    });
    setAmount('');
    setCategory('');
    setSubcategory('');
    setNote('');
  };

  if (active.length === 0) {
    return (
      <Card>
        <SectionTitle>Log expense</SectionTitle>
        <EmptyState title="Create a bucket first" description="Expenses draw down from a bucket's balance — set one up in the Buckets tab." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Log expense</SectionTitle>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="expense-amount">Amount</Label>
            <Input id="expense-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="45.00" />
          </div>
          <div>
            <Label htmlFor="expense-bucket">Bucket</Label>
            <Select id="expense-bucket" value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
              {active.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="expense-category">Category</Label>
            <Input id="expense-category" list="known-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Groceries" />
            <datalist id="known-categories">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="expense-subcategory">Subcategory (optional)</Label>
            <Input id="expense-subcategory" list="known-subcategories" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Produce" />
            <datalist id="known-subcategories">
              {knownSubcategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <Label htmlFor="expense-note">Note (optional)</Label>
          <Input id="expense-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Trader Joe's run" />
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={submit} disabled={amountNum <= 0 || !bucketId || !category.trim()}>
            Log expense
          </Button>
        </div>
      </div>
    </Card>
  );
}
