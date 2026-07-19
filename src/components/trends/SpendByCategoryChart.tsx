import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../lib/store';
import { monthsWithActivity, spendByCategoryForMonth } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CATEGORICAL, CHART_INK, MAX_CATEGORICAL_SERIES, OTHER_LABEL } from '../../lib/chartTheme';
import { EmptyState } from '../ui/primitives';

export function SpendByCategoryChart() {
  const events = useStore((s) => s.events);

  const { data, categories } = useMemo(() => {
    const months = monthsWithActivity(events).slice(-6); // last 6 active months
    const byMonth = months.map((m) => spendByCategoryForMonth(events, m));

    const totals = new Map<string, number>();
    for (const monthData of byMonth) {
      for (const [cat, amt] of Object.entries(monthData)) totals.set(cat, (totals.get(cat) ?? 0) + amt);
    }
    const sortedCats = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    const topCap = MAX_CATEGORICAL_SERIES - 1; // reserve one slot for "Other"
    const topCats = sortedCats.slice(0, topCap).map(([c]) => c);
    const hasOther = sortedCats.length > topCap;

    const rows = months.map((m, i) => {
      const monthData = byMonth[i];
      const row: Record<string, number | string> = { month: m };
      let other = 0;
      for (const [cat, amt] of Object.entries(monthData)) {
        if (topCats.includes(cat)) row[cat] = (Number(row[cat]) || 0) + amt;
        else other += amt;
      }
      if (hasOther) row[OTHER_LABEL] = other;
      return row;
    });

    return { data: rows, categories: hasOther ? [...topCats, OTHER_LABEL] : topCats };
  }, [events]);

  if (data.length === 0) {
    return <EmptyState title="No expenses logged yet" description="Spend by category will appear here once you log expenses." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(v: string) => monthLabel(v).split(' ')[0]}
            stroke={CHART_INK.axis}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_INK.axis }}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(v)}
            stroke={CHART_INK.axis}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value) || 0), name]}
            labelFormatter={(v) => monthLabel(String(v ?? ''))}
            contentStyle={{ borderRadius: 6, borderColor: CHART_INK.gridline, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="spend"
              fill={i < CATEGORICAL.length ? CATEGORICAL[i] : CHART_INK.muted}
              radius={i === categories.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
