import { useMemo, useRef } from 'react';
import { useVisibleEvents, useBudgets, useStore } from '../../lib/store';
import { budgetStatuses } from '../../lib/analysis';
import { formatMoney, monthLabel } from '../../lib/format';
import { PRIMARY, COMPLEMENT, STATUS } from '../../lib/chartTheme';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { EmptyState } from '../ui/primitives';

const TONE = { ok: PRIMARY, close: COMPLEMENT, over: STATUS.critical } as const;
const WORD = { ok: 'on track', close: 'close to limit', over: 'over budget' } as const;

/**
 * Every budgeted category as a meter against its limit.
 *
 * Sorted by how much of the limit is used rather than alphabetically, so the
 * categories about to become a problem are the ones at the top — the reason to
 * open this card at all.
 */
export function BudgetProgress({ month }: { month: string }) {
  const events = useVisibleEvents();
  const budgets = useBudgets();
  const openDrill = useStore((s) => s.openDrill);
  const scope = useRef<HTMLDivElement>(null);

  const statuses = useMemo(() => budgetStatuses(events, budgets, month), [events, budgets, month]);

  useGSAP(
    () => {
      const bars = gsap.utils.toArray<HTMLElement>('.budget-fill');
      if (bars.length === 0) return;
      gsap.fromTo(
        bars,
        { scaleX: 0 },
        {
          scaleX: (_i, t: HTMLElement) => Number(t.dataset.ratio ?? 1),
          duration: prefersReducedMotion() ? 0 : DUR.draw,
          ease: EASE.draw,
          stagger: prefersReducedMotion() ? 0 : 0.05,
        }
      );
    },
    { dependencies: [statuses], scope }
  );

  if (statuses.length === 0) {
    return <EmptyState title="No budgets set" description="Set monthly limits per category in Entries to track them here." />;
  }

  return (
    <div ref={scope} className="space-y-3">
      {statuses.map((s) => {
        const tone = TONE[s.state];
        return (
          // "Over budget" is a claim, and the only useful next question is which
          // charges made it so. Clicking the meter answers it.
          <button
            key={s.category}
            type="button"
            onClick={() =>
              openDrill({
                title: s.category,
                subtitle: `${monthLabel(month)} — ${formatMoney(s.spent)} of a ${formatMoney(s.limit)} limit`,
                filter: { month, category: s.category },
              })
            }
            aria-label={`Show what makes up ${s.category}`}
            className="block w-full cursor-pointer rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-2/60"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-ink-secondary">{s.category}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="num-col text-ink-muted">
                  {formatMoney(s.spent)} / {formatMoney(s.limit)}
                </span>
                <span className="num-col font-semibold" style={{ color: tone }}>
                  {Math.round(s.ratio * 100)}%
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${tone}26` }}>
              <div
                className="budget-fill h-full w-full origin-left rounded-full"
                data-ratio={Math.min(s.ratio, 1)}
                style={{ backgroundColor: tone }}
              />
            </div>
            {/* State is always written out, never carried by the bar colour alone. */}
            {s.state !== 'ok' && (
              <p className="mt-1 text-xs" style={{ color: tone }}>
                {WORD[s.state]}
                {s.state === 'over' && ` by ${formatMoney(s.spent - s.limit)}`}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
