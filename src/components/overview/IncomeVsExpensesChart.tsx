import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../lib/store';
import { monthsWithActivity, totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CATEGORICAL, CHART_INK } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

export function IncomeVsExpensesChart() {
  const events = useStore((s) => s.events);

  const data = useMemo(() => {
    const months = monthsWithActivity(events).slice(-6);
    return months.map((m) => ({
      month: m,
      Income: totalIncomeForMonth(events, m),
      Expenses: totalOutflowForMonth(events, m),
    }));
  }, [events]);
  const lastIndex = data.length - 1;

  if (data.length === 0) {
    return <EmptyState title="No income or expenses logged yet" description="Cash flow will appear here once you log activity." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} syncId="home-timeline" margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
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
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} valueFormatter={(v) => formatMoney(v)} />}
            cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          <Line type="monotone" dataKey="Income" stroke={CATEGORICAL[0]} strokeWidth={2} dot={{ r: 3, fill: CATEGORICAL[0] }} activeDot={{ r: 4 }} />
          <Line
            type="monotone"
            dataKey="Expenses"
            stroke={CATEGORICAL[5]}
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || typeof cx !== 'number' || typeof cy !== 'number') {
                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={CATEGORICAL[5]} />;
              }
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={5} fill={CATEGORICAL[5]} stroke={CHART_INK.surface} strokeWidth={2} />
                  <text x={cx - 8} y={cy - 12} textAnchor="end" fontSize={11} fill={CHART_INK.secondary}>
                    Now: {formatMoney(data[lastIndex].Expenses)}
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
