import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../lib/store';
import { monthsWithActivity, spendByCategoryForMonth } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CHART_INK, MAX_CATEGORICAL_SERIES, OTHER_LABEL, categoryColorMap, rankedCategories } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

export function SpendByCategoryChart() {
  const events = useStore((s) => s.events);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const { data, categories } = useMemo(() => {
    const months = monthsWithActivity(events).slice(-6); // last 6 active months
    const byMonth = months.map((m) => spendByCategoryForMonth(events, m));

    // Same historical ranking every other chart uses (see chartTheme.ts) — not a
    // local top-N over just this window — so "top" categories here match "top"
    // categories (and their colors) everywhere else in the app.
    const topCap = MAX_CATEGORICAL_SERIES - 1; // reserve one slot for "Other"
    const topCats = rankedCategories(events).slice(0, topCap);
    const seenBeyondTop = new Set<string>();

    const rows = months.map((m, i) => {
      const monthData = byMonth[i];
      const row: Record<string, number | string> = { month: m };
      let other = 0;
      for (const [cat, amt] of Object.entries(monthData)) {
        if (topCats.includes(cat)) row[cat] = (Number(row[cat]) || 0) + amt;
        else {
          other += amt;
          seenBeyondTop.add(cat);
        }
      }
      if (seenBeyondTop.size > 0 || other > 0) row[OTHER_LABEL] = other;
      return row;
    });

    return { data: rows, categories: seenBeyondTop.size > 0 ? [...topCats, OTHER_LABEL] : topCats };
  }, [events]);

  if (data.length === 0) {
    return <EmptyState title="No expenses logged yet" description="Spend by category will appear here once you log expenses." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* maxBarSize caps the column so a two-month window doesn't render as
            two saturated slabs the width of the card — the mark stays a mark. */}
        <BarChart data={data} syncId="home-timeline" maxBarSize={48} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
            cursor={{ fill: CHART_INK.gridline, opacity: 0.4 }}
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} valueFormatter={(v) => formatMoney(v)} />}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          {categories.map((cat, i) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="spend"
              fill={colors.get(cat) ?? CHART_INK.muted}
              radius={i === categories.length - 1 ? [3, 3, 0, 0] : undefined}
              activeBar={{ fillOpacity: 0.75, stroke: CHART_INK.surface, strokeWidth: 2 }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
