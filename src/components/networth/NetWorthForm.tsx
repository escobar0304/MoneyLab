import { useMemo, useState } from 'react';
import type { NetWorthEntry } from '../../lib/types';
import { useStore, useBuckets } from '../../lib/store';
import { bucketBalances } from '../../lib/derive';
import { Button, Card, Input, Label, SectionTitle } from '../ui/primitives';
import { formatSignedMoney } from '../../lib/format';

function EntryRows({
  rows,
  onChange,
}: {
  rows: NetWorthEntry[];
  onChange: (rows: NetWorthEntry[]) => void;
}) {
  const update = (i: number, patch: Partial<NetWorthEntry>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { name: '', category: '', amount: 0 }]);

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="flex-1" placeholder="Name (e.g. Checking account)" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
          <Input className="w-28" placeholder="Category" value={r.category} onChange={(e) => update(i, { category: e.target.value })} />
          <Input className="w-24" type="number" step={0.01} placeholder="0.00" value={r.amount || ''} onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })} />
          <button type="button" className="px-1 text-neutral-400 hover:text-red-600" onClick={() => remove(i)} aria-label="Remove">
            ✕
          </button>
        </div>
      ))}
      <Button variant="secondary" className="text-xs" onClick={add}>
        + Add
      </Button>
    </div>
  );
}

export function NetWorthForm() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const takeNetWorthSnapshot = useStore((s) => s.takeNetWorthSnapshot);

  const [assets, setAssets] = useState<NetWorthEntry[]>([]);
  const [liabilities, setLiabilities] = useState<NetWorthEntry[]>([]);

  const investedBuckets = useMemo(() => buckets.filter((b) => !b.archived && (b.kind === 'investment' || b.kind === 'savings')), [buckets]);
  const balances = useMemo(() => bucketBalances(events), [events]);

  const submit = () => {
    takeNetWorthSnapshot(
      assets.filter((a) => a.name.trim()),
      liabilities.filter((l) => l.name.trim())
    );
    setAssets([]);
    setLiabilities([]);
  };

  return (
    <Card>
      <SectionTitle action={<Button onClick={submit}>Log net worth today</Button>}>Assets &amp; liabilities</SectionTitle>

      {investedBuckets.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Auto-included from investment/savings buckets</p>
          <div className="space-y-1">
            {investedBuckets.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-neutral-700">{b.name}</span>
                <span className="tabular-nums text-neutral-900">{formatSignedMoney(balances[b.id] ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <Label>Manual assets</Label>
          <EntryRows rows={assets} onChange={setAssets} />
        </div>
        <div>
          <Label>Liabilities</Label>
          <EntryRows rows={liabilities} onChange={setLiabilities} />
        </div>
      </div>
    </Card>
  );
}
