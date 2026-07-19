import { useMemo } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { bucketVarianceForMonth } from '../../lib/derive';
import { Badge, Card, EmptyState, SectionTitle } from '../ui/primitives';
import { formatSignedMoney, monthLabel } from '../../lib/format';

export function ThisMonthSummary() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const month = new Date().toISOString().slice(0, 7);

  const variance = useMemo(() => {
    const active = buckets.filter((b) => !b.archived && b.kind !== 'unallocated');
    return bucketVarianceForMonth(events, active, month)
      .filter((v) => v.allocated !== 0 || v.actual !== 0)
      .sort((a, b) => a.variance - b.variance);
  }, [events, buckets, month]);

  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unknown';
  const totalAllocated = variance.reduce((s, v) => s + v.allocated, 0);
  const totalActual = variance.reduce((s, v) => s + v.actual, 0);

  return (
    <Card>
      <SectionTitle>{monthLabel(month)} vs. allocation</SectionTitle>
      {variance.length === 0 ? (
        <EmptyState title="No activity yet this month" />
      ) : (
        <>
          <div className="mb-3 flex gap-6 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Allocated</p>
              <p className="font-semibold tabular-nums">{formatSignedMoney(totalAllocated)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Spent</p>
              <p className="font-semibold tabular-nums">{formatSignedMoney(totalActual)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {variance.map((v) => (
              <div key={v.bucketId} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
                <span className="truncate text-sm font-medium text-neutral-900">{bucketName(v.bucketId)}</span>
                <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
                  <span>{formatSignedMoney(v.actual)} / {formatSignedMoney(v.allocated)}</span>
                  <Badge tone={v.variance < 0 ? 'bad' : 'good'}>{v.variance < 0 ? 'Over' : 'Under'} {formatSignedMoney(Math.abs(v.variance))}</Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
