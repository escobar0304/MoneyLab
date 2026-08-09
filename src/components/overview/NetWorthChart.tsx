import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../lib/store';
import { balanceSeries } from '../../lib/derive';
import { CHART_INK, SEQUENTIAL_BLUE } from '../../lib/chartTheme';
import { formatMoney, formatDate } from '../../lib/format';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyState } from '../ui/primitives';

export function NetWorthChart() {
  const events = useStore((s) => s.events);
  // Sliced to the same trailing window as the other two synced timeline charts
  // (IncomeVsExpensesChart, SpendByCategoryChart) so index-based syncId alignment
  // (Recharts syncs by data index, not by matching X value) points at the same month.
  const data = useMemo(() => balanceSeries(events).slice(-6), [events]);
  const lastIndex = data.length - 1;

  if (data.length === 0) {
    return <EmptyState title="No history yet" description="Net worth over time will show up here once you log income or expenses." />;
  }
  if (data.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="text-3xl font-semibold text-ink">{formatMoney(data[0].value)}</p>
        <p className="mt-1 text-xs text-ink-muted">{formatDate(data[0].timestamp)} — keep logging to see a trend</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} syncId="home-timeline" margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.18} />
              <stop offset="100%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_INK.gridline} vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v: string) => formatDate(v)}
            stroke={CHART_INK.axis}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_INK.axis }}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoney(v)}
            stroke={CHART_INK.axis}
            tick={{ fill: CHART_INK.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            content={<ChartTooltip labelFormatter={(l) => formatDate(String(l))} valueFormatter={(v) => formatMoney(v)} />}
            cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SEQUENTIAL_BLUE}
            strokeWidth={2}
            fill="url(#netWorthFill)"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || typeof cx !== 'number' || typeof cy !== 'number') return <g key={`dot-${index}`} />;
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={5} fill={SEQUENTIAL_BLUE} stroke={CHART_INK.surface} strokeWidth={2} />
                  <text x={cx - 8} y={cy - 12} textAnchor="end" fontSize={11} fill={CHART_INK.secondary}>
                    Now: {formatMoney(data[lastIndex].value)}
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 4, fill: SEQUENTIAL_BLUE, stroke: CHART_INK.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
