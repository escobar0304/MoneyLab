import { useMemo } from 'react';
import { useVisibleEvents, useStore } from '../../../lib/core/store';
import { pendingWorthItChecks } from '../../../lib/insight/worthIt';
import { formatMoney } from '../../../lib/core/format';
import { Card, Button } from '../../ui/primitives';

/**
 * A later check-in on big purchases, once the initial excitement (or regret)
 * has worn off — the one card here that isn't another number, it's a
 * question. Nothing enforces an answer; it just sits here, the same way
 * Subscription alerts does, until it's dealt with or the ledger has nothing
 * left to ask about.
 */
export function WorthItCheckIn() {
  const events = useVisibleEvents();
  const setWorthIt = useStore((s) => s.setWorthIt);
  const pending = useMemo(() => pendingWorthItChecks(events), [events]);

  if (pending.length === 0) return null;

  return (
    <Card>
      <p className="t-label">Worth it?</p>
      <p className="mt-1 text-sm text-ink-secondary">
        {pending.length} {pending.length === 1 ? 'purchase' : 'purchases'} from over a week ago, still waiting on a verdict.
      </p>

      <ul className="mt-3 space-y-2">
        {pending.slice(0, 3).map(({ entry }) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-secondary">
              {entry.category}
              {entry.note && ` · ${entry.note}`}
            </span>
            <span className="num-col shrink-0 text-ink">{formatMoney(entry.amount)}</span>
            <span className="flex shrink-0 gap-1.5">
              <Button variant="ghost" onClick={() => setWorthIt(entry.id, true)}>
                Yes
              </Button>
              <Button variant="ghost" onClick={() => setWorthIt(entry.id, false)}>
                No
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {pending.length > 3 && <p className="mt-2 text-xs text-ink-muted">and {pending.length - 3} more</p>}
    </Card>
  );
}
