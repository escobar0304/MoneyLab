import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '../../lib/store';
import { spendByCategoryForMonth } from '../../lib/derive';
import { formatMoney } from '../../lib/format';
import { CHART_INK, OTHER_LABEL, categoryColorMap } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

/** A donut is only legible as part-to-whole at a glance; past six slices the
 * small wedges stop being comparable, so the tail folds into "Other". */
const MAX_SLICES = 6;

export function SpendByCategoryPie({ month }: { month: string }) {
  const events = useStore((s) => s.events);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const data = useMemo(() => {
    const sorted = Object.entries(spendByCategoryForMonth(events, month))
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_SLICES) return sorted;
    const head = sorted.slice(0, MAX_SLICES - 1);
    const tail = sorted.slice(MAX_SLICES - 1).reduce((sum, d) => sum + d.value, 0);
    return [...head, { name: OTHER_LABEL, value: tail }];
  }, [events, month]);

  if (data.length === 0) {
    return <EmptyState title="No expenses this month" />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            cornerRadius={4}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={colors.get(d.name) ?? CHART_INK.muted} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />} />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
