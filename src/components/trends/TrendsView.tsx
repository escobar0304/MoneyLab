import { useMemo } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { netWorthSeries } from '../../lib/derive';
import { Card, SectionTitle } from '../ui/primitives';
import { NetWorthChart } from '../networth/NetWorthChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { AllocationVsActualChart } from './AllocationVsActualChart';

export function TrendsView() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const series = useMemo(() => netWorthSeries(events, buckets), [events, buckets]);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Net worth over time</SectionTitle>
        <NetWorthChart data={series} />
      </Card>
      <Card>
        <SectionTitle>Spend by category</SectionTitle>
        <SpendByCategoryChart />
      </Card>
      <Card>
        <SectionTitle>Allocation vs. actual</SectionTitle>
        <AllocationVsActualChart />
      </Card>
    </div>
  );
}
