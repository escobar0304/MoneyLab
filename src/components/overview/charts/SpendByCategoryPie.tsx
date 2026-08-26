import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useVisibleEvents, useStore } from '../../../lib/core/store';
import { spendByCategoryForMonth } from '../../../lib/core/derive';
import { formatMoney, monthLabel } from '../../../lib/core/format';
import { CHART_INK, OTHER_LABEL, categoryColorMap } from '../../../lib/insight/chartTheme';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyState } from '../../ui/primitives';

/** A donut is only legible as part-to-whole at a glance; past six slices the
 * small wedges stop being comparable, so the tail folds into "Other". */
const MAX_SLICES = 6;

export function SpendByCategoryPie({ month }: { month: string }) {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const { data, total, otherMembers } = useMemo(() => {
    const sorted = Object.entries(spendByCategoryForMonth(events, month))
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, d) => s + d.value, 0);
    if (sorted.length <= MAX_SLICES) return { data: sorted, total, otherMembers: [] as string[] };
    const head = sorted.slice(0, MAX_SLICES - 1);
    const tail = sorted.slice(MAX_SLICES - 1);
    return {
      data: [...head, { name: OTHER_LABEL, value: tail.reduce((sum, d) => sum + d.value, 0) }],
      total,
      // Kept so the folded slice can still be opened: "Other" stands for these
      // categories, and a mark you cannot drill into is a dead end exactly where
      // the reader is most curious.
      otherMembers: tail.map((d) => d.name),
    };
  }, [events, month]);

  /** Opens whichever categories the clicked slice stands for. */
  const drill = (name: string) =>
    openDrill(
      name === OTHER_LABEL
        ? { title: 'Other categories', subtitle: `${otherMembers.join(', ')} · ${monthLabel(month)}`, filter: { month, categories: otherMembers } }
        : { title: name, subtitle: monthLabel(month), filter: { month, category: name } }
    );

  if (data.length === 0) {
    return <EmptyState title="No expenses this month" />;
  }

  return (
    <div>
      <div className="relative h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              // Recharts' pie entrance animation mis-measures the arc on first
              // paint and renders slivers; the reveal is handled by the card.
              isAnimationActive={false}
              onClick={(slice: { name?: string }) => slice?.name && drill(slice.name)}
              style={{ cursor: 'pointer' }}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={colors.get(d.name) ?? CHART_INK.muted} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* The hole is the natural home for the total — otherwise the donut is a
            ring with a hole punched in the card, which is what made it read as a
            dropped-in widget. Not interactive, so it must not eat pointer events. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-ink-muted">Total</span>
          <span className="t-figure text-ink">{formatMoney(total)}</span>
        </div>
      </div>

      {/* An app-styled list rather than Recharts' centred legend: same line-key
          as the tooltips, plus the share, so the values aren't hover-gated. */}
      <ul className="mt-3 space-y-0.5">
        {data.map((d) => (
          <li key={d.name}>
            {/* The legend drills too. Arcs are a small target and impossible to
                reach by keyboard; the list is the accessible way in. */}
            <button
              type="button"
              onClick={() => drill(d.name)}
              aria-label={`Show what makes up ${d.name}`}
              className="flex w-full cursor-pointer items-baseline gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:bg-surface-2/60"
            >
              <span
                className="inline-block h-0.5 w-3 shrink-0 -translate-y-0.5 rounded-full"
                style={{ backgroundColor: colors.get(d.name) ?? CHART_INK.muted }}
              />
              <span className="min-w-0 flex-1 truncate text-ink-secondary">{d.name}</span>
              <span className="num-col shrink-0 text-ink-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
              <span className="num-col w-20 shrink-0 text-right font-medium text-ink">{formatMoney(d.value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
