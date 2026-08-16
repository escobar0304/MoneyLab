import { useMemo, useRef } from 'react';
import { useVisibleEvents, useStore } from '../../lib/store';
import { totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { formatMoney, monthLabel } from '../../lib/format';
import { PRIMARY, COMPLEMENT, STATUS } from '../../lib/chartTheme';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { EmptyState } from '../ui/primitives';


/**
 * Spend against the month's income, as a meter rather than the two-slice donut
 * this replaces — a two-segment pie is a stat tile wearing a costume, and it
 * forces the reader to compare two angles when the question ("how much of it
 * have I used?") is one number on one axis.
 *
 * Severity rides the fill (accent -> warning -> critical) over a track that is a
 * lighter step of the same ramp, and is *always* restated in text: colour alone
 * never carries the state.
 */
export function BudgetMeter({ month }: { month: string }) {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);
  const fillRef = useRef<HTMLDivElement>(null);

  const { income, spent, pct, over } = useMemo(() => {
    const income = totalIncomeForMonth(events, month);
    const spent = totalOutflowForMonth(events, month);
    return {
      income,
      spent,
      pct: income > 0 ? (spent / income) * 100 : 0,
      over: spent > income,
    };
  }, [events, month]);

  // Blue while there's headroom, sliding to its complement as the month is used
  // up, and only reaching the reserved alarm colour once you're actually over.
  const tone = over ? STATUS.critical : pct >= 80 ? COMPLEMENT : PRIMARY;

  useGSAP(
    () => {
      if (!fillRef.current) return;
      gsap.fromTo(
        fillRef.current,
        { scaleX: 0 },
        {
          scaleX: Math.min(pct, 100) / 100,
          duration: prefersReducedMotion() ? 0 : DUR.draw,
          ease: EASE.draw,
        }
      );
    },
    { dependencies: [pct, month] }
  );

  if (income === 0) {
    return <EmptyState title="No income logged this month" description="Log a salary or extra income to see how much of it you've used." />;
  }

  return (
    <div>
      <p className="t-label">Spent of income</p>
      {/* The figure is the drill target, so the meter reads as a number you can
          open rather than a button wrapped around the whole tile. */}
      <button
        type="button"
        onClick={() =>
          openDrill({ title: `Spending in ${monthLabel(month)}`, subtitle: `Against ${formatMoney(income)} earned`, filter: { month, type: 'expense' } })
        }
        className="t-metric mt-1 cursor-pointer rounded-md text-ink transition-colors hover:text-accent"
        aria-label="Show what makes up this month's spending"
      >
        <AnimatedNumber value={spent} format={formatMoney} />
      </button>

      {/* 10px track, fully rounded ends, no border — the track's own tint does
          the separating rather than a stroke around the fill. */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${tone}26` }}>
        <div ref={fillRef} className="h-full w-full origin-left rounded-full" style={{ backgroundColor: tone }} />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-muted">
          of <span className="num-col text-ink-secondary">{formatMoney(income)}</span> earned
        </span>
        <span className="num-col font-medium" style={{ color: tone }}>
          {pct.toFixed(0)}%
        </span>
      </div>

      {over && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-critical-text">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.75.75 0 0 0-.75.75v2.6a.75.75 0 0 0 1.5 0v-2.6A.75.75 0 0 0 8 5.7Zm0 5.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
          </svg>
          Over by {formatMoney(spent - income)}
        </p>
      )}
    </div>
  );
}
