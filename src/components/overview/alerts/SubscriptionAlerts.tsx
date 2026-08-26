import { useMemo } from 'react';
import { useVisibleEvents } from '../../../lib/core/store';
import { detectSubscriptions, subscriptionTotal } from '../../../lib/money/subscriptions';
import { formatMoney } from '../../../lib/core/format';
import { Card, Badge, Button } from '../../ui/primitives';
import { requestNavigate } from '../../../lib/core/navigate';

/**
 * Subscriptions worth a second look — undeclared, or quietly repriced.
 *
 * The detection already runs on Entries → Manage, but nothing points there
 * unless you go looking, so a subscription that crept up in price can sit
 * unnoticed for months — exactly the kind of gap this app exists to close.
 * Mirrors that panel's own "needs attention" filter, and says nothing at all
 * when it's empty: an all-clear card here would just be more noise on a page
 * that already has a lot to look at.
 */
export function SubscriptionAlerts() {
  const events = useVisibleEvents();
  const all = useMemo(() => detectSubscriptions(events), [events]);
  const attention = useMemo(() => all.filter((s) => !s.ruled || s.drift), [all]);

  if (attention.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-label">Repeating charges worth a look</p>
          <p className="mt-1 text-sm text-ink-secondary">
            <span className="num-col text-ink">{formatMoney(subscriptionTotal(attention))}</span> a year across{' '}
            {attention.length} {attention.length === 1 ? 'charge' : 'charges'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => requestNavigate({ tab: 'entries', section: 'manage' })}>
          Review
        </Button>
      </div>

      <ul className="mt-3 space-y-1.5">
        {attention.slice(0, 3).map((sub) => (
          <li key={sub.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink-secondary">
              <span className="truncate">{sub.label}</span>
              {sub.drift && (
                <Badge tone={sub.drift.pct > 0 ? 'bad' : 'good'}>
                  {sub.drift.pct > 0 ? '↑' : '↓'} {Math.abs(sub.drift.pct)}%
                </Badge>
              )}
              {!sub.ruled && <Badge>No rule</Badge>}
            </span>
            <span className="num-col shrink-0 text-ink-muted">{formatMoney(sub.yearlyCost)}/yr</span>
          </li>
        ))}
      </ul>
      {attention.length > 3 && <p className="mt-2 text-xs text-ink-muted">and {attention.length - 3} more</p>}
    </Card>
  );
}
