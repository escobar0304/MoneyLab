import { useMemo, useRef } from 'react';
import { useVisibleEvents } from '../../lib/store';
import { spendByCategoryForMonth, previousMonthKey } from '../../lib/derive';
import { formatMoney, monthLabel } from '../../lib/format';
import { PRIMARY, COMPLEMENT, CHART_INK } from '../../lib/chartTheme';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { EmptyState } from '../ui/primitives';

const BEFORE_SHADE = '#86b6ef'; // step 250 of the blue ramp — the "before" shade

/**
 * Dumbbell: two dots per category, last month and this, joined by the distance
 * between them. This is the documented form for "before → after per item" — and
 * it beats two bars side by side because the *gap* is the subject, and here the
 * gap is drawn literally rather than left for the reader to subtract.
 *
 * The connector is the only thing that carries direction in colour, and it is
 * backed by dot order and a signed number, so nothing depends on hue alone.
 */
export function CategoryDumbbell({ month }: { month: string }) {
  const events = useVisibleEvents();
  const scope = useRef<HTMLDivElement>(null);

  const { rows, max } = useMemo(() => {
    const current = spendByCategoryForMonth(events, month);
    const previous = spendByCategoryForMonth(events, previousMonthKey(month));
    const names = Array.from(new Set([...Object.keys(current), ...Object.keys(previous)])).sort(
      (a, b) => (current[b] ?? 0) - (current[a] ?? 0)
    );
    const max = Math.max(...names.map((n) => Math.max(current[n] ?? 0, previous[n] ?? 0)), 0);
    return {
      max,
      rows: names.slice(0, 8).map((name) => ({ name, now: current[name] ?? 0, then: previous[name] ?? 0 })),
    };
  }, [events, month]);

  // The "now" dot travels out from where the category sat last month, so the
  // animation itself shows the movement the chart is about.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const nows = gsap.utils.toArray<HTMLElement>('.dumbbell-now');
      const bars = gsap.utils.toArray<HTMLElement>('.dumbbell-link');
      if (nows.length === 0) return;
      gsap.from(nows, {
        left: (_i: number, t: HTMLElement) => t.dataset.from ?? '0%',
        duration: DUR.draw,
        ease: EASE.draw,
        stagger: 0.05,
      });
      gsap.from(bars, { scaleX: 0, duration: DUR.draw, ease: EASE.draw, stagger: 0.05 });
    },
    { dependencies: [rows], scope }
  );

  if (rows.length === 0 || max === 0) {
    return <EmptyState title="No expenses to compare" description="Two months of spending are needed before categories can be compared." />;
  }

  const pct = (v: number) => (v / max) * 100;

  return (
    <div ref={scope}>
      <div className="space-y-2.5">
        {rows.map((row) => {
          const delta = row.now - row.then;
          const from = Math.min(pct(row.then), pct(row.now));
          const span = Math.abs(pct(row.now) - pct(row.then));
          const rose = delta > 0;
          return (
            <div key={row.name} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
              <span className="truncate text-xs font-medium text-ink-secondary">{row.name}</span>

              {/* Inset by the dot radius so a dot at 0% or 100% sits fully inside. */}
              <div className="relative h-5">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hairline" />
                <div className="absolute inset-x-1.25 top-0 bottom-0">
                  {span > 0 && (
                    <span
                      className="dumbbell-link absolute top-1/2 h-0.5 origin-left -translate-y-1/2 rounded-full"
                      style={{ left: `${from}%`, width: `${span}%`, backgroundColor: rose ? COMPLEMENT : PRIMARY }}
                    />
                  )}
                  {row.then > 0 && (
                    <span
                      className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${pct(row.then)}%`, backgroundColor: BEFORE_SHADE, boxShadow: `0 0 0 2px ${CHART_INK.surface}` }}
                      title={`${monthLabel(previousMonthKey(month))}: ${formatMoney(row.then)}`}
                    />
                  )}
                  <span
                    className="dumbbell-now absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    data-from={`${pct(row.then)}%`}
                    style={{ left: `${pct(row.now)}%`, backgroundColor: PRIMARY, boxShadow: `0 0 0 2px ${CHART_INK.surface}` }}
                    title={`${monthLabel(month)}: ${formatMoney(row.now)}`}
                  />
                </div>
              </div>

              <span className="flex items-baseline justify-end gap-2 text-xs">
                {delta !== 0 && row.then > 0 && (
                  <span className={`num-col ${rose ? 'text-complement' : 'text-positive'}`}>
                    {rose ? '+' : '−'}
                    {formatMoney(Math.abs(delta))}
                  </span>
                )}
                <span className="num-col w-20 text-right font-semibold text-ink">{formatMoney(row.now)}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-hairline pt-2.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BEFORE_SHADE }} />
          {monthLabel(previousMonthKey(month))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRIMARY }} />
          {monthLabel(month)}
        </span>
      </div>
    </div>
  );
}
