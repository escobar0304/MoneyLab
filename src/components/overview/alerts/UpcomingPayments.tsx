import { useMemo } from 'react';
import { useVisibleEvents } from '../../../lib/core/store';
import { projectRunway } from '../../../lib/planning/runway';
import { daysUntil } from '../../../lib/core/recurrence';
import { formatMoney } from '../../../lib/core/format';
import { Card, SectionTitle } from '../../ui/primitives';

/** How far ahead to look for scheduled items — long enough to plan around,
 * short enough that "in 47 days" doesn't drown out what's actually close. */
const HORIZON_DAYS = 30;
const MAX_SHOWN = 6;

function when(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * What's scheduled to post next, in the order it will actually happen.
 *
 * The runway chart already answers "will I be okay" for the weeks ahead —
 * this answers the question underneath it, "what's actually landing and
 * when", which the chart's own shape can't spell out. Reuses `projectRunway`
 * rather than re-deriving due dates: the two have to agree, or the balance
 * line and this list would tell two different stories about the same rules.
 */
export function UpcomingPayments() {
  const events = useVisibleEvents();
  const runway = useMemo(() => projectRunway(events, { days: HORIZON_DAYS }), [events]);

  const items = useMemo(() => {
    const out: { date: string; label: string; amount: number; kind: 'income' | 'expense' }[] = [];
    for (const day of runway.days) {
      for (const item of day.items) out.push({ date: day.date, ...item });
    }
    return out.slice(0, MAX_SHOWN);
  }, [runway]);

  if (items.length === 0) return null;

  return (
    <Card level="quiet">
      <SectionTitle>Coming up</SectionTitle>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-secondary">{item.label}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-ink-muted">{when(daysUntil(new Date(item.date)))}</span>
              <span className={`num-col w-20 text-right font-medium ${item.kind === 'income' ? 'text-positive' : 'text-ink'}`}>
                {item.kind === 'income' ? '+' : '−'}
                {formatMoney(item.amount)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
