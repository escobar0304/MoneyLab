import { useMemo } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { netWorthAt, netWorthSeries } from '../../lib/derive';
import { Card, SectionTitle } from '../ui/primitives';
import { formatMoney } from '../../lib/format';
import { NetWorthChart } from './NetWorthChart';
import { NetWorthForm } from './NetWorthForm';

export function NetWorthView() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();

  const current = useMemo(() => netWorthAt(events, buckets), [events, buckets]);
  const series = useMemo(() => netWorthSeries(events, buckets), [events, buckets]);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Net worth</SectionTitle>
        <p className="text-3xl font-semibold tabular-nums text-neutral-900">{formatMoney(current)}</p>
        <div className="mt-4">
          <NetWorthChart data={series} />
        </div>
      </Card>
      <NetWorthForm />
    </div>
  );
}
