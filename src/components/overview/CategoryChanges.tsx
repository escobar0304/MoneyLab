import { useMemo } from 'react';
import { useVisibleEvents } from '../../lib/store';
import { categoryNovelty } from '../../lib/analysis';
import { monthKey } from '../../lib/derive';
import { formatMoney } from '../../lib/format';
import { Card, SectionTitle, Badge } from '../ui/primitives';

/**
 * Two kinds of change no chart on this page shows on its own: a category with
 * no history before this month, and one that had spend every month for a
 * while and suddenly has none.
 *
 * Purely informative, on purpose. There's no "usual" size to judge a
 * first-time category against, and a subscription cancelled deliberately
 * looks identical here to one simply forgotten — so this only ever says what
 * changed, never whether that's good or bad, and offers nothing to click.
 */
export function CategoryChanges() {
  const events = useVisibleEvents();
  const month = monthKey(new Date().toISOString());
  const novelty = useMemo(() => categoryNovelty(events, month), [events, month]);

  if (novelty.firstTime.length === 0 && novelty.wentQuiet.length === 0) return null;

  return (
    <Card level="quiet">
      <SectionTitle>What&apos;s different this month</SectionTitle>
      <div className="space-y-3">
        {novelty.firstTime.length > 0 && (
          <div>
            <p className="t-label mb-1.5">New this month</p>
            <ul className="space-y-1">
              {novelty.firstTime.map((f) => (
                <li key={f.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink-secondary">
                    <span className="truncate">{f.category}</span>
                    <Badge>first time</Badge>
                  </span>
                  <span className="num-col shrink-0 text-ink">{formatMoney(f.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {novelty.wentQuiet.length > 0 && (
          <div>
            <p className="t-label mb-1.5">Went quiet</p>
            <ul className="space-y-1">
              {novelty.wentQuiet.map((q) => (
                <li key={q.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink-secondary">{q.category}</span>
                  <span className="num-col shrink-0 text-xs text-ink-muted">usually {formatMoney(q.usualAmount)}/mo</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
