import { useState } from 'react';
import { useStore, useSalary } from '../../lib/store';
import { Button, Card, Input, Label, SectionTitle } from '../ui/primitives';
import { formatMoney, formatDate, todayInputValue } from '../../lib/format';

export function SalaryForm() {
  const salary = useSalary();
  const upsertSalary = useStore((s) => s.upsertSalary);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(salary ? String(salary.amount) : '');
  const [startDate, setStartDate] = useState(salary?.startDate.slice(0, 10) ?? todayInputValue());

  const amountNum = Number(amount) || 0;
  const showForm = !salary || editing;

  const submit = () => {
    if (amountNum <= 0) return;
    upsertSalary({ id: salary?.id, amount: amountNum, startDate: new Date(startDate).toISOString() });
    setEditing(false);
  };

  return (
    <Card>
      <SectionTitle>Monthly salary</SectionTitle>
      {!showForm && salary ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-ink">{formatMoney(salary.amount)}</p>
            <p className="text-xs text-ink-muted">Every month since {formatDate(salary.startDate)}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setAmount(String(salary.amount));
              setStartDate(salary.startDate.slice(0, 10));
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="salary-amount">Amount / month</Label>
              <Input id="salary-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3000" autoFocus />
            </div>
            <div>
              <Label htmlFor="salary-start">Starting</Label>
              <Input id="salary-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {salary && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button onClick={submit} disabled={amountNum <= 0}>
              {salary ? 'Save' : 'Set salary'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
