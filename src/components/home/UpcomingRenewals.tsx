import { useMemo } from 'react';
import { useSubscriptions } from '../../lib/store';
import { nextRenewalDate, daysUntil } from '../../lib/subscriptions';
import { Badge, Card, EmptyState, SectionTitle } from '../ui/primitives';
import { formatMoney, formatDate } from '../../lib/format';

export function UpcomingRenewals() {
  const subscriptions = useSubscriptions();

  const upcoming = useMemo(() => {
    const now = new Date();
    return subscriptions
      .filter((s) => !s.cancelled)
      .map((s) => {
        const renewsAt = nextRenewalDate(s, now);
        const trialConvertsSoon =
          !!s.trialEndDate && new Date(s.trialEndDate).getTime() > now.getTime() && daysUntil(new Date(s.trialEndDate), now) <= 3;
        return { sub: s, renewsAt, days: daysUntil(renewsAt, now), trialConvertsSoon };
      })
      .filter((r) => r.days <= 7 || r.trialConvertsSoon)
      .sort((a, b) => a.days - b.days);
  }, [subscriptions]);

  return (
    <Card>
      <SectionTitle>Upcoming renewals</SectionTitle>
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing renewing in the next 7 days" />
      ) : (
        <div className="space-y-2">
          {upcoming.map(({ sub, renewsAt, days, trialConvertsSoon }) => (
            <div key={sub.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{sub.name}</p>
                <p className="text-xs text-neutral-500">{formatDate(renewsAt.toISOString())}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {trialConvertsSoon && <Badge tone="warn">Trial converts soon</Badge>}
                <Badge tone={days <= 2 ? 'bad' : 'neutral'}>{days <= 0 ? 'Today' : `${days}d`}</Badge>
                <span className="text-sm font-medium tabular-nums text-neutral-900">{formatMoney(sub.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
