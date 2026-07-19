import { useState } from 'react';
import type { Bucket, BucketKind, ID } from '../../lib/types';
import { useStore } from '../../lib/store';
import { Button, Input, Label, Select } from '../ui/primitives';

const KIND_OPTIONS: { value: BucketKind; label: string }[] = [
  { value: 'category', label: 'Category (spending)' },
  { value: 'investment', label: 'Investment (feeds net worth)' },
  { value: 'savings', label: 'Savings (feeds net worth)' },
  { value: 'debt', label: 'Debt' },
  { value: 'subscription', label: 'Subscription' },
];

export function BucketForm({
  buckets,
  editing,
  onDone,
}: {
  buckets: Bucket[];
  editing?: Bucket;
  onDone: () => void;
}) {
  const upsertBucket = useStore((s) => s.upsertBucket);
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<BucketKind>(editing?.kind ?? 'category');
  const [parentId, setParentId] = useState<ID | ''>(editing?.parentId ?? '');

  const parentOptions = buckets.filter((b) => !b.archived && b.kind !== 'unallocated' && b.id !== editing?.id);

  const submit = () => {
    if (!name.trim()) return;
    upsertBucket({
      id: editing?.id,
      name: name.trim(),
      kind,
      parentId: parentId || null,
    });
    onDone();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="bucket-name">Name</Label>
        <Input id="bucket-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stocks" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bucket-kind">Type</Label>
          <Select id="bucket-kind" value={kind} onChange={(e) => setKind(e.target.value as BucketKind)}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bucket-parent">Parent (optional)</Label>
          <Select id="bucket-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None (top level)</option>
            {parentOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit}>{editing ? 'Save' : 'Create bucket'}</Button>
      </div>
    </div>
  );
}
