import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Button, Input, Label } from '../ui/primitives';
import { todayInputValue } from '../../lib/format';

/** A quick way to log one-off income (a bonus, a gift, a side gig payment) that isn't
 * your salary. */
export function ExtraIncomeForm() {
  const addIncome = useStore((s) => s.addIncome);
  const [open, setOpen] = useState(false);

  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayInputValue());

  const amountNum = Number(amount) || 0;

  const submit = () => {
    if (amountNum <= 0 || !label.trim()) return;
    addIncome({ amount: amountNum, label: label.trim(), date: new Date(date).toISOString() });
    setAmount('');
    setLabel('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="text-sm font-medium text-neutral-400 hover:text-neutral-100" onClick={() => setOpen(true)}>
        + Add extra income
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <Label htmlFor="extra-amount">Amount</Label>
          <Input id="extra-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200" autoFocus />
        </div>
        <div>
          <Label htmlFor="extra-label">Label</Label>
          <Input id="extra-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Birthday gift" />
        </div>
        <div>
          <Label htmlFor="extra-date">Date</Label>
          <Input id="extra-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={amountNum <= 0 || !label.trim()}>
          Log it
        </Button>
      </div>
    </div>
  );
}
