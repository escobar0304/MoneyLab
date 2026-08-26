import { useMemo } from 'react';
import { useStore } from '../../../lib/core/store';
import { monthsWithActivity } from '../../../lib/core/derive';
import { formatDate, todayInputValue } from '../../../lib/core/format';
import { Input, Button } from '../../ui/primitives';

/**
 * Renders the dashboard as it stood on a chosen date.
 *
 * Almost free, and only because of a decision made much earlier: the ledger is
 * append-only, so the state of the app on any date *is* the events up to that
 * date. Nothing is replayed, nothing is stored twice — the filter is the
 * feature. An app that kept mutable balances could not offer this at all
 * without a second history to go wrong.
 *
 * Scoped to the read-only views. Editing while looking at the past would raise
 * a question with no good answer — whether the edit belongs to then or now.
 */
export function TimeTravel() {
  const events = useStore((s) => s.events);
  const asOf = useStore((s) => s.asOf);
  const setAsOf = useStore((s) => s.setAsOf);

  // Before the first entry there is nothing to look at, so the picker stops there.
  const earliest = useMemo(() => {
    const months = monthsWithActivity(events);
    return months.length > 0 ? `${months[0]}-01` : todayInputValue();
  }, [events]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4 text-xs text-ink-muted">
      <span>See this page as it stood on</span>
      <span className="w-40">
        <Input
          type="date"
          value={asOf ?? todayInputValue()}
          min={earliest}
          max={todayInputValue()}
          onChange={(e) => setAsOf(e.target.value === todayInputValue() ? null : e.target.value || null)}
          aria-label="View the dashboard as of"
        />
      </span>
      {asOf && (
        <Button variant="secondary" onClick={() => setAsOf(null)}>
          Back to now
        </Button>
      )}
    </div>
  );
}

/**
 * Says loudly that these numbers are not current.
 *
 * Without it the dashboard is indistinguishable from the live one, and a stale
 * balance that looks live is worse than no feature at all.
 */
export function TimeTravelBanner() {
  const asOf = useStore((s) => s.asOf);
  const setAsOf = useStore((s) => s.setAsOf);
  if (!asOf) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
      <p className="text-sm text-ink-secondary">
        Showing <strong className="text-ink">{formatDate(`${asOf}T12:00:00.000Z`)}</strong> — everything below is how it stood
        that day, not today.
      </p>
      <Button variant="secondary" onClick={() => setAsOf(null)}>
        Back to now
      </Button>
    </div>
  );
}
