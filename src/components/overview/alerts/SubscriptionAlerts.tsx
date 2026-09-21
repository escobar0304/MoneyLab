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

      {/* Name and cost stay paired on one line at every width — that is the
          comparison this panel exists to offer — and the badges drop to a line
          of their own below the breakpoint. Before, all four competed for one
          row: at 390px the badges held their width and the name was truncated
          to "Dinne…", which is the one part of the row you cannot reconstruct
          from the rest of it. */}
      <ul className="mt-3 space-y-2.5 sm:space-y-1.5">
        {attention.slice(0, 3).map((sub) => (
          <li key={sub.key} className="text-sm sm:flex sm:items-center sm:justify-between sm:gap-3">
            <span className="flex items-baseline justify-between gap-3 text-ink-secondary sm:min-w-0 sm:items-center sm:justify-start">
              <span className="min-w-0 truncate">{sub.label}</span>
              <span className="num-col shrink-0 text-ink-muted sm:hidden">{formatMoney(sub.yearlyCost)}/yr</span>
            </span>
            {(sub.drift || !sub.ruled) && (
              <span className="mt-1 flex flex-wrap items-center gap-2 sm:mt-0 sm:mr-auto sm:ml-2 sm:flex-nowrap">
                {sub.drift && (
                  <Badge tone={sub.drift.pct > 0 ? 'bad' : 'good'}>
                    {sub.drift.pct > 0 ? '↑' : '↓'} {Math.abs(sub.drift.pct)}%
                  </Badge>
                )}
                {!sub.ruled && <Badge>No rule</Badge>}
              </span>
            )}
            <span className="num-col hidden shrink-0 text-ink-muted sm:inline">{formatMoney(sub.yearlyCost)}/yr</span>
          </li>
        ))}
      </ul>
      {attention.length > 3 && <p className="mt-2 text-xs text-ink-muted">and {attention.length - 3} more</p>}
    </Card>
  );
}
