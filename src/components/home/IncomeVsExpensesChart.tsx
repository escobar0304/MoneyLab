import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../lib/store';
import { monthsWithActivity, totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CATEGORICAL, CHART_INK } from '../../lib/chartTheme';
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

  if (data.length === 0) {
    return <EmptyState title="No income or expenses logged yet" description="Cash flow will appear here once you log activity." />;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
            contentStyle={{ borderRadius: 6, background: '#232322', borderColor: '#383835', fontSize: 12, color: CHART_INK.primary }}
            labelStyle={{ color: CHART_INK.secondary }}
            itemStyle={{ color: CHART_INK.primary }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
          <Line type="monotone" dataKey="Income" stroke={CATEGORICAL[0]} strokeWidth={2} dot={{ r: 3, fill: CATEGORICAL[0] }} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="Expenses" stroke={CATEGORICAL[5]} strokeWidth={2} dot={{ r: 3, fill: CATEGORICAL[5] }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
