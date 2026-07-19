import { useMemo } from 'react';
import { useStore, useBuckets } from '../../lib/store';
import { bucketBalances } from '../../lib/derive';
import { Card, EmptyState, SectionTitle } from '../ui/primitives';
import { formatSignedMoney } from '../../lib/format';

export function BalanceGrid() {
  const buckets = useBuckets();
  const events = useStore((s) => s.events);
  const balances = useMemo(() => bucketBalances(events), [events]);
  const active = buckets.filter((b) => !b.archived);

  if (active.length === 0) {
    return (
      <Card>
        <SectionTitle>Bucket balances</SectionTitle>
        <EmptyState title="No buckets yet" />
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Bucket balances</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {active.map((b) => {
          const balance = balances[b.id] ?? 0;
          return (
            <div key={b.id} className="rounded-lg border border-neutral-200 p-3">
              <p className="truncate text-xs font-medium text-neutral-500">{b.name}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${balance < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                {formatSignedMoney(balance)}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
