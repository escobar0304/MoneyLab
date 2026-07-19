import { useMemo, useState } from 'react';
import type { Bucket, ID } from '../../lib/types';
import { UNALLOCATED_BUCKET_ID } from '../../lib/types';
import { useStore, useBuckets } from '../../lib/store';
import { bucketBalances } from '../../lib/derive';
import { Badge, Button, Card, EmptyState, Modal, SectionTitle } from '../ui/primitives';
import { formatSignedMoney } from '../../lib/format';
import { BucketForm } from './BucketForm';

const KIND_LABEL: Record<string, string> = {
  category: 'Category',
  investment: 'Investment',
  savings: 'Savings',
  debt: 'Debt',
  subscription: 'Subscription',
  unallocated: 'Unallocated',
};

interface Node {
  bucket: Bucket;
  children: Node[];
}

function buildTree(buckets: Bucket[]): Node[] {
  const byParent = new Map<ID | null, Bucket[]>();
  for (const b of buckets) {
    const key = b.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), b]);
  }
  const build = (parentId: ID | null): Node[] =>
    (byParent.get(parentId) ?? []).map((bucket) => ({ bucket, children: build(bucket.id) }));
  return build(null);
}

export function BucketTree() {
  const buckets = useBuckets();
  const events = useStore((s) => s.events);
  const archiveBucket = useStore((s) => s.archiveBucket);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Bucket | null>(null);

  const active = buckets.filter((b) => !b.archived);
  const balances = useMemo(() => bucketBalances(events), [events]);
  const tree = useMemo(() => buildTree(active), [active]);

  const renderNode = (node: Node, depth: number) => (
    <div key={node.bucket.id}>
      <div
        className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-0"
        style={{ paddingLeft: depth * 20 }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-neutral-900">{node.bucket.name}</span>
            <Badge>{KIND_LABEL[node.bucket.kind]}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-sm font-medium tabular-nums ${
              (balances[node.bucket.id] ?? 0) < 0 ? 'text-red-600' : 'text-neutral-900'
            }`}
          >
            {formatSignedMoney(balances[node.bucket.id] ?? 0)}
          </span>
          {node.bucket.id !== UNALLOCATED_BUCKET_ID && (
            <div className="flex gap-1">
              <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(node.bucket)}>
                Edit
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => archiveBucket(node.bucket.id)}>
                Archive
              </Button>
            </div>
          )}
        </div>
      </div>
      {node.children.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  return (
    <Card>
      <SectionTitle action={<Button onClick={() => setCreating(true)}>New bucket</Button>}>Buckets</SectionTitle>
      {tree.length === 0 ? (
        <EmptyState title="No buckets yet" description="Create a bucket to start allocating income into it." />
      ) : (
        <div>{tree.map((n) => renderNode(n, 0))}</div>
      )}

      {creating && (
        <Modal title="New bucket" onClose={() => setCreating(false)}>
          <BucketForm buckets={active} onDone={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit bucket" onClose={() => setEditing(null)}>
          <BucketForm buckets={active} editing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </Card>
  );
}
