import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useVisibleEvents, useStore } from '../../lib/store';
import { monthsWithActivity, totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { PRIMARY, COMPLEMENT, CHART_INK } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { ChartLegend, EndpointLabel, Plot, crosshair, gridProps, niceScale, plotMargin, xAxisProps, yAxisProps } from '../ui/chartChrome';
import { EmptyState } from '../ui/primitives';

export function IncomeVsExpensesChart() {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);

  const data = useMemo(() => {
    const months = monthsWithActivity(events).slice(-6);
    return months.map((m) => ({
      month: m,
      Income: totalIncomeForMonth(events, m),
      Expenses: totalOutflowForMonth(events, m),
    }));
  }, [events]);
  const lastIndex = data.length - 1;
  const scale = useMemo(() => niceScale(Math.max(...data.flatMap((d) => [d.Income, d.Expenses]), 0)), [data]);

  if (data.length === 0) {
    return <EmptyState title="No income or expenses logged yet" description="Cash flow will appear here once you log activity." />;
  }

  return (
    <Plot>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          syncId="home-timeline"
          margin={plotMargin}
          // Chart-level, not per-line: the two series share an X position, and
          // asking whether the click landed nearer income or expenses would be
          // guessing at something the reader did not intend to say.
          onClick={(state) => {
            const month = state?.activeLabel;
            if (typeof month === 'string') {
              openDrill({ title: monthLabel(month), subtitle: 'Everything in and out that month', filter: { month } });
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" tickFormatter={(v: string) => monthLabel(v).split(' ')[0]} {...xAxisProps} />
          <YAxis {...yAxisProps} {...(scale ?? {})} />
          <Tooltip
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} valueFormatter={(v) => formatMoney(v)} />}
            cursor={crosshair}
          />
          <Legend content={<ChartLegend />} verticalAlign="top" align="left" height={22} />
          <Line
            type="monotone"
            dataKey="Income"
            stroke={PRIMARY}
            strokeWidth={2}
            dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: CHART_INK.surface, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="Expenses"
            stroke={COMPLEMENT}
            strokeWidth={2}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={`dot-${index}`} />;
              if (index !== lastIndex) return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={COMPLEMENT} />;
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={4} fill={COMPLEMENT} stroke={CHART_INK.surface} strokeWidth={2} />
                  <EndpointLabel x={cx} y={cy}>
                    {formatMoney(data[lastIndex].Expenses)}
                  </EndpointLabel>
                </g>
              );
            }}
            activeDot={{ r: 4, stroke: CHART_INK.surface, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Plot>
  );
}
