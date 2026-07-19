import { useMemo, useState } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { spendByCategoryForMonth, previousMonthKey, bucketVarianceForMonth, monthsWithActivity } from '../../lib/derive';
import { Badge, Card, EmptyState, Select, SectionTitle } from '../ui/primitives';
import { formatSignedMoney, monthLabel } from '../../lib/format';

export function MonthlySummary() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const months = useMemo(() => monthsWithActivity(events), [events]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const selectableMonths = months.includes(currentMonth) ? months : [...months, currentMonth].sort();

  const thisMonth = useMemo(() => spendByCategoryForMonth(events, month), [events, month]);
  const lastMonth = useMemo(() => spendByCategoryForMonth(events, previousMonthKey(month)), [events, month]);
  const categories = Array.from(new Set([...Object.keys(thisMonth), ...Object.keys(lastMonth)])).sort();

  const variance = useMemo(() => {
    const active = buckets.filter((b) => !b.archived && b.kind !== 'unallocated');
    return bucketVarianceForMonth(events, active, month).filter((v) => v.allocated !== 0 || v.actual !== 0);
  }, [events, buckets, month]);
  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unknown';

  return (
    <Card>
      <SectionTitle
        action={
          <Select className="w-40" value={month} onChange={(e) => setMonth(e.target.value)}>
            {selectableMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        }
      >
        Monthly summary
      </SectionTitle>

      {categories.length === 0 ? (
        <EmptyState title="No expenses logged this month" />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => {
            const cur = thisMonth[c] ?? 0;
            const prev = lastMonth[c] ?? 0;
            const delta = cur - prev;
            return (
              <div key={c} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
                <span className="truncate text-sm font-medium text-neutral-900">{c}</span>
                <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
                  <span>vs {formatSignedMoney(prev)} last month</span>
                  {delta !== 0 && (
                    <Badge tone={delta > 0 ? 'bad' : 'good'}>
                      {delta > 0 ? '+' : ''}
                      {formatSignedMoney(delta)}
                    </Badge>
                  )}
                  <span className="w-16 text-right font-medium tabular-nums text-neutral-900">{formatSignedMoney(cur)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {variance.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-neutral-500">Overspend / underspend vs. allocation</p>
          <div className="space-y-2">
            {variance
              .sort((a, b) => a.variance - b.variance)
              .map((v) => (
                <div key={v.bucketId} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
                  <span className="truncate text-sm font-medium text-neutral-900">{bucketName(v.bucketId)}</span>
                  <Badge tone={v.variance < 0 ? 'bad' : 'good'}>
                    {v.variance < 0 ? 'Over' : 'Under'} {formatSignedMoney(Math.abs(v.variance))}
                  </Badge>
                </div>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
}
