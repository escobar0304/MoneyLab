import { useMemo } from 'react';
import { useVisibleEvents, useStore } from '../../../lib/core/store';
import { findAnomalies } from '../../../lib/insight/analysis';
import { formatMoney, formatDate, monthLabel } from '../../../lib/core/format';
import { categoryColorMap } from '../../../lib/insight/chartTheme';

/**
 * Charges that are large for their own category.
 *
 * Framed as "worth a look", not as a warning: an unusual expense is very often
 * a perfectly intended one, and the useful job here is surfacing it for a
 * second's attention rather than implying a mistake. The comparison figure is
 * always shown so the claim can be checked instead of trusted.
 */
export function Anomalies({ month }: { month: string }) {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);
  const colors = useMemo(() => categoryColorMap(events), [events]);
  const anomalies = useMemo(() => findAnomalies(events, month).slice(0, 5), [events, month]);

  if (anomalies.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">
        Nothing unusual this month.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {anomalies.map(({ event, median }) => (
        <li key={event.id}>
          {/* Opens the whole category for the month rather than this one charge:
              "is this normal for me" is the question the card raises, and one
              row on its own cannot answer it. */}
          <button
            type="button"
            onClick={() =>
              openDrill({
                title: event.category,
                subtitle: `${monthLabel(month)} — usually around ${formatMoney(median)} a charge`,
                filter: { month, category: event.category },
              })
            }
            aria-label={`Show what makes up ${event.category} this month`}
            className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-hairline p-2.5 text-left transition-colors hover:border-border hover:bg-surface-2/60"
          >
          <span className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colors.get(event.category) ?? 'var(--color-ink-muted)' }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink-secondary">
                {event.category}
                {event.note ? ` · ${event.note}` : ''}
              </span>
              <span className="block text-xs text-ink-muted">
                {formatDate(event.timestamp)} · usually around <span className="num-col">{formatMoney(median)}</span>
              </span>
            </span>
          </span>
          <span className="num-col shrink-0 text-sm font-semibold text-complement">{formatMoney(event.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
