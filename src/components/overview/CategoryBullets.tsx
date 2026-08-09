import { useMemo, useRef } from 'react';
import { useStore } from '../../lib/store';
import { spendByCategoryForMonth, previousMonthKey } from '../../lib/derive';
import { formatMoney } from '../../lib/format';
import { CHART_INK, categoryColorMap } from '../../lib/chartTheme';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { EmptyState } from '../ui/primitives';

/**
 * A bullet-chart grid: one row per category, this month's spend as the bar and
 * last month's as a benchmark tick behind it. It answers "which categories moved,
 * and by how much" in a single scan, which a pie of this month alone cannot —
 * a pie has no room for the comparison value.
 *
 * Every number is rendered as text as well as encoded in bar length, so the row
 * is readable without colour vision and without hovering.
 */
export function CategoryBullets({ month }: { month: string }) {
  const events = useStore((s) => s.events);
  const scope = useRef<HTMLDivElement>(null);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const rows = useMemo(() => {
    const current = spendByCategoryForMonth(events, month);
    const previous = spendByCategoryForMonth(events, previousMonthKey(month));
    const names = Object.keys(current).sort((a, b) => current[b] - current[a]);
    // The shared scale is the largest value in *either* month, so the benchmark
    // tick and the bar are measured against the same axis.
    const max = Math.max(...names.map((n) => Math.max(current[n], previous[n] ?? 0)), 0);
    return names.slice(0, 8).map((name) => ({
      name,
      value: current[name],
      previous: previous[name] ?? 0,
      max,
    }));
  }, [events, month]);

  useGSAP(
    () => {
      const bars = gsap.utils.toArray<HTMLElement>('.bullet-bar');
      if (bars.length === 0) return;
      gsap.fromTo(
        bars,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: prefersReducedMotion() ? 0 : DUR.draw,
          ease: EASE.draw,
          stagger: prefersReducedMotion() ? 0 : 0.045,
        }
      );
    },
    { dependencies: [rows], scope }
  );

  if (rows.length === 0) {
    return <EmptyState title="No expenses this month" description="Categories will rank here as you log spending." />;
  }

  return (
    <div ref={scope} className="space-y-3">
      {rows.map((row) => {
        const delta = row.value - row.previous;
        const widthPct = row.max > 0 ? (row.value / row.max) * 100 : 0;
        const markerPct = row.max > 0 ? (row.previous / row.max) * 100 : 0;
        return (
          <div key={row.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-neutral-300">{row.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                {row.previous > 0 && delta !== 0 && (
                  <span className={`num-col ${delta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {delta > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(delta))}
                  </span>
                )}
                <span className="num-col font-semibold text-neutral-100">{formatMoney(row.value)}</span>
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-neutral-800/70">
              <div
                className="bullet-bar h-full origin-left rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: colors.get(row.name) ?? CHART_INK.muted }}
              />
              {row.previous > 0 && (
                // Benchmark tick, ringed in the surface colour so it stays
                // legible where it sits on top of the bar.
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300 ring-2 ring-surface-1"
                  // Inset so a benchmark equal to the row maximum still draws
                  // fully inside the track instead of half past its end.
                  style={{ left: `calc(${markerPct}% - ${(markerPct / 100) * 2}px + 1px)` }}
                  title={`Last month: ${formatMoney(row.previous)}`}
                />
              )}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-neutral-500">
        Bar is this month · <span className="mx-0.5 inline-block h-2.5 w-0.5 translate-y-0.5 rounded-full bg-neutral-300" /> marks last month
      </p>
    </div>
  );
}
