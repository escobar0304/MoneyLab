import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useVisibleEvents } from '../../lib/store';
import { spendByCategoryForMonth } from '../../lib/derive';
import { formatMoney } from '../../lib/format';
import { CHART_INK, OTHER_LABEL, categoryColorMap } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

/** A donut is only legible as part-to-whole at a glance; past six slices the
 * small wedges stop being comparable, so the tail folds into "Other". */
const MAX_SLICES = 6;

export function SpendByCategoryPie({ month }: { month: string }) {
  const events = useVisibleEvents();
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const { data, total } = useMemo(() => {
    const sorted = Object.entries(spendByCategoryForMonth(events, month))
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, d) => s + d.value, 0);
    if (sorted.length <= MAX_SLICES) return { data: sorted, total };
    const head = sorted.slice(0, MAX_SLICES - 1);
    const tail = sorted.slice(MAX_SLICES - 1).reduce((sum, d) => sum + d.value, 0);
    return { data: [...head, { name: OTHER_LABEL, value: tail }], total };
  }, [events, month]);

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
          <span className="text-xl font-semibold text-ink">{formatMoney(total)}</span>
        </div>
      </div>

      {/* An app-styled list rather than Recharts' centred legend: same line-key
          as the tooltips, plus the share, so the values aren't hover-gated. */}
      <ul className="mt-3 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-baseline gap-2 text-xs">
            <span
              className="inline-block h-0.5 w-3 shrink-0 -translate-y-0.5 rounded-full"
              style={{ backgroundColor: colors.get(d.name) ?? CHART_INK.muted }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{d.name}</span>
            <span className="num-col shrink-0 text-ink-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
            <span className="num-col w-20 shrink-0 text-right font-medium text-ink">{formatMoney(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
