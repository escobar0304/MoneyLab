import { useMemo, useState } from 'react';
import { useStore, useBuckets, useSubscriptions } from '../../lib/store';
import type { LedgerEvent } from '../../lib/types';
import { Badge, Card, EmptyState, Select, SectionTitle } from '../ui/primitives';
import { formatDateTime, formatSignedMoney } from '../../lib/format';

type FilterKey = 'all' | 'income' | 'expense' | 'subscription' | 'networth' | 'admin';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'networth', label: 'Net worth' },
  { key: 'admin', label: 'Buckets & templates' },
];

function matchesFilter(e: LedgerEvent, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'income') return e.type === 'income';
  if (filter === 'expense') return e.type === 'expense';
  if (filter === 'subscription') return e.type === 'subscription_charge' || e.type === 'subscription_upsert' || e.type === 'subscription_cancel';
  if (filter === 'networth') return e.type === 'networth_snapshot';
  if (filter === 'admin') return e.type === 'bucket_upsert' || e.type === 'bucket_archive' || e.type === 'template_upsert';
  return true;
}

export function LedgerTimeline() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const subscriptions = useSubscriptions();
  const [filter, setFilter] = useState<FilterKey>('all');

  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unknown bucket';
  const subName = (id: string) => subscriptions.find((s) => s.id === id)?.name ?? 'Unknown subscription';

  const rows = useMemo(() => {
    return events
      .filter((e) => matchesFilter(e, filter))
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [events, filter]);

  const describe = (e: LedgerEvent): { title: string; detail?: string; amount?: number; tone: 'good' | 'bad' | 'neutral' } => {
    switch (e.type) {
      case 'income':
        return {
          title: e.label,
          detail: `Allocated to ${e.allocations.length} bucket${e.allocations.length === 1 ? '' : 's'}: ${e.allocations
            .map((a) => `${bucketName(a.bucketId)} ${formatSignedMoney(a.amount)}`)
            .join(', ')}`,
          amount: e.amount,
          tone: 'good',
        };
      case 'expense':
        return {
          title: `${e.category}${e.subcategory ? ' / ' + e.subcategory : ''}`,
          detail: `From ${bucketName(e.bucketId)}${e.note ? ' — ' + e.note : ''}`,
          amount: -e.amount,
          tone: 'bad',
        };
      case 'subscription_charge':
        return {
          title: subName(e.subscriptionId),
          detail: `Renewal charge from ${bucketName(e.bucketId)}`,
          amount: -e.amount,
          tone: 'bad',
        };
      case 'networth_snapshot': {
        const assets = e.assets.reduce((s, a) => s + a.amount, 0);
        const liabilities = e.liabilities.reduce((s, a) => s + a.amount, 0);
        return { title: 'Net worth snapshot', detail: `Manual assets ${formatSignedMoney(assets)}, liabilities ${formatSignedMoney(liabilities)}`, tone: 'neutral' };
      }
      case 'bucket_upsert':
        return { title: `Bucket saved: ${e.bucket.name}`, tone: 'neutral' };
      case 'bucket_archive':
        return { title: `Bucket archived: ${bucketName(e.bucketId)}`, tone: 'neutral' };
      case 'subscription_upsert':
        return { title: `Subscription saved: ${e.subscription.name}`, tone: 'neutral' };
      case 'subscription_cancel':
        return { title: `Subscription cancelled: ${subName(e.subscriptionId)}`, tone: 'neutral' };
      case 'template_upsert':
        return { title: `Template saved: ${e.template.name}`, tone: 'neutral' };
    }
  };

  return (
    <Card>
      <SectionTitle
        action={
          <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        }
      >
        History
      </SectionTitle>

      {rows.length === 0 ? (
        <EmptyState title="No ledger events yet" />
      ) : (
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {rows.map((e) => {
            const d = describe(e);
            return (
              <div key={e.id} className="rounded-lg border border-neutral-200 p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-900">{d.title}</span>
                      <Badge>{e.type.replace('_', ' ')}</Badge>
                    </div>
                    {d.detail && <p className="mt-0.5 text-xs text-neutral-500">{d.detail}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    {d.amount !== undefined && (
                      <p className={`text-sm font-medium tabular-nums ${d.tone === 'bad' ? 'text-red-600' : d.tone === 'good' ? 'text-emerald-600' : 'text-neutral-900'}`}>
                        {formatSignedMoney(d.amount)}
                      </p>
                    )}
                    <p className="text-xs text-neutral-400">{formatDateTime(e.timestamp)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
