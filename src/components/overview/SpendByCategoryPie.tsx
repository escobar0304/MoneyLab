import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '../../lib/store';
import { spendByCategoryForMonth } from '../../lib/derive';
import { formatMoney } from '../../lib/format';
import { CHART_INK, categoryColorMap } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

export function SpendByCategoryPie({ month }: { month: string }) {
  const events = useStore((s) => s.events);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const data = useMemo(() => {
    const byCategory = spendByCategoryForMonth(events, month);
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
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
