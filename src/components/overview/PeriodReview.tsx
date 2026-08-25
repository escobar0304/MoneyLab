import { useMemo, useState } from 'react';
import { useVisibleEvents } from '../../lib/store';
import { buildPeriodReview, currentPeriod, shiftPeriod, type ReviewKind } from '../../lib/review';
import { formatMoney, formatSignedMoney, monthLabel } from '../../lib/format';
import { categoryColorMap } from '../../lib/chartTheme';
import { Button, Modal } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';

const KINDS: { id: ReviewKind; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function periodLabel(kind: ReviewKind, period: string): string {
  return kind === 'month' ? monthLabel(period) : period;
}

/** The recap itself, kept apart from the modal chrome so switching period or
 * kind only re-renders this half. */
function ReviewContent({ kind, period }: { kind: ReviewKind; period: string }) {
  const events = useVisibleEvents();
  const review = useMemo(() => buildPeriodReview(events, kind, period), [events, kind, period]);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  if (review.income === 0 && review.spend === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-muted">Nothing logged in this period.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="t-label">Saved</p>
        <p className={`t-hero mt-1 ${review.saved < 0 ? 'text-critical-text' : 'text-ink'}`}>{formatMoney(review.saved)}</p>
        <p className="t-caption mt-1">
          <span className="num-col text-ink-secondary">{formatMoney(review.income)}</span> in ·{' '}
          <span className="num-col text-ink-secondary">{formatMoney(review.spend)}</span> out
          {review.savingsRatePct !== null && (
            <>
              {' · '}
              <span className="num-col">{review.savingsRatePct.toFixed(1)}%</span> savings rate
            </>
          )}
        </p>
      </div>

      {review.topCategories.length > 0 && (
        <div>
          <p className="t-label mb-2">Where it went</p>
          <ul className="space-y-1.5">
            {review.topCategories.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colors.get(c.category) ?? 'var(--color-ink-muted)' }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{c.category}</span>
                <span className="num-col text-xs text-ink-muted">{c.share}%</span>
                <span className="num-col w-20 shrink-0 text-right font-medium text-ink">{formatMoney(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-hairline p-3">
          <p className="t-label">Net worth</p>
          <p className={`num-col mt-1 text-sm font-medium ${review.netWorthChange >= 0 ? 'text-positive' : 'text-complement'}`}>
            {review.netWorthChange >= 0 ? '+' : ''}
            {formatSignedMoney(review.netWorthChange)}
          </p>
        </div>
        {review.subscriptions.count > 0 && (
          <div className="rounded-lg border border-hairline p-3">
            <p className="t-label">Repeating charges</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {review.subscriptions.count} tracked
              {review.subscriptions.undeclared > 0 && `, ${review.subscriptions.undeclared} without a rule`}
              {review.subscriptions.drifted > 0 && `, ${review.subscriptions.drifted} repriced`}
            </p>
          </div>
        )}
      </div>

      {review.biggestSurprise && (
        <div className="rounded-lg border border-hairline p-3">
          <p className="t-label">Biggest surprise</p>
          <p className="mt-1 text-sm text-ink-secondary">
            <span className="text-ink">{review.biggestSurprise.event.category}</span>
            {review.biggestSurprise.event.note && ` · ${review.biggestSurprise.event.note}`} —{' '}
            <span className="num-col text-ink">{formatMoney(review.biggestSurprise.event.amount)}</span>, usually around{' '}
            <span className="num-col">{formatMoney(review.biggestSurprise.median)}</span>
          </p>
        </div>
      )}

      {kind === 'year' && (review.bestMonth || review.worstMonth) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {review.bestMonth && (
            <div className="rounded-lg border border-hairline p-3">
              <p className="t-label">Best month</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {monthLabel(review.bestMonth.month)} · <span className="num-col text-positive">{formatMoney(review.bestMonth.saved)}</span> saved
              </p>
            </div>
          )}
          {review.worstMonth && review.worstMonth.month !== review.bestMonth?.month && (
            <div className="rounded-lg border border-hairline p-3">
              <p className="t-label">Toughest month</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {monthLabel(review.worstMonth.month)} · <span className="num-col">{formatMoney(review.worstMonth.saved)}</span> saved
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A recap of one month or one year, on request rather than always on screen.
 *
 * Nothing here is a new figure — it's the same per-month numbers the rest of
 * Overview already computes, just summed across a period and read back as one
 * story instead of a wall of charts. A year works exactly like a month
 * because the ledger is append-only: "how did 2026 go" is a filter over the
 * same array Time Travel already proves can answer questions like this.
 */
export function PeriodReview() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReviewKind>('month');
  const [period, setPeriod] = useState(() => currentPeriod('month'));

  const changeKind = (next: ReviewKind) => {
    setKind(next);
    setPeriod(currentPeriod(next));
  };

  const isCurrent = period === currentPeriod(kind);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Year &amp; month in review
      </Button>

      {open && (
        <Modal title="In review" onClose={() => setOpen(false)} width="lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <Segmented options={KINDS} value={kind} onChange={changeKind} label="Period" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous period"
                onClick={() => setPeriod((p) => shiftPeriod(kind, p, -1))}
                className="rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                ‹
              </button>
              <span className="min-w-[9rem] text-center text-sm font-medium text-ink">{periodLabel(kind, period)}</span>
              <button
                type="button"
                aria-label="Next period"
                disabled={isCurrent}
                onClick={() => setPeriod((p) => shiftPeriod(kind, p, 1))}
                className="rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
          <ReviewContent kind={kind} period={period} />
        </Modal>
      )}
    </>
  );
}
