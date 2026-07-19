import { useState } from 'react';
import type { Subscription, SubscriptionCycle } from '../../lib/types';
import { useStore, useBuckets } from '../../lib/store';
import { Button, Input, Label, Select } from '../ui/primitives';
import { todayInputValue } from '../../lib/format';

export function SubscriptionForm({ editing, onDone }: { editing?: Subscription; onDone: () => void }) {
  const buckets = useBuckets().filter((b) => !b.archived);
  const upsertSubscription = useStore((s) => s.upsertSubscription);

  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [cycle, setCycle] = useState<SubscriptionCycle>(editing?.cycle ?? 'monthly');
  const [startDate, setStartDate] = useState(editing?.startDate.slice(0, 10) ?? todayInputValue());
  const [trialEndDate, setTrialEndDate] = useState(editing?.trialEndDate?.slice(0, 10) ?? '');
  const [bucketId, setBucketId] = useState(editing?.bucketId ?? buckets[0]?.id ?? '');

  const amountNum = Number(amount) || 0;

  const submit = () => {
    if (!name.trim() || amountNum <= 0 || !bucketId) return;
    upsertSubscription({
      id: editing?.id,
      name: name.trim(),
      amount: amountNum,
      cycle,
      startDate: new Date(startDate).toISOString(),
      trialEndDate: trialEndDate ? new Date(trialEndDate).toISOString() : undefined,
      bucketId,
      cancelled: editing?.cancelled,
    });
    onDone();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="sub-name">Name</Label>
        <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sub-amount">Amount</Label>
          <Input id="sub-amount" type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15.49" />
        </div>
        <div>
          <Label htmlFor="sub-cycle">Billing cycle</Label>
          <Select id="sub-cycle" value={cycle} onChange={(e) => setCycle(e.target.value as SubscriptionCycle)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sub-start">Start date</Label>
          <Input id="sub-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sub-trial">Trial ends (optional)</Label>
          <Input id="sub-trial" type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="sub-bucket">Linked bucket</Label>
        <Select id="sub-bucket" value={bucketId} onChange={(e) => setBucketId(e.target.value)}>
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim() || amountNum <= 0 || !bucketId}>
          {editing ? 'Save' : 'Add subscription'}
        </Button>
      </div>
    </div>
  );
}
