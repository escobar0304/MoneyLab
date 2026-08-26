import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useVisibleEvents, useStore } from '../../../lib/core/store';
import { balanceSeries, monthKey } from '../../../lib/core/derive';
import { CHART_INK, PRIMARY } from '../../../lib/insight/chartTheme';
import { formatMoney, formatDate, monthLabel } from '../../../lib/core/format';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EndpointLabel, Plot, crosshair, gridProps, niceScale, plotMargin, xAxisProps, yAxisProps } from '../../ui/chartChrome';
import { EmptyState } from '../../ui/primitives';

export function NetWorthChart() {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);
  // Sliced to the same trailing window as the other two synced timeline charts
  // (IncomeVsExpensesChart, SpendByCategoryChart) so index-based syncId alignment
  // (Recharts syncs by data index, not by matching X value) points at the same month.
  const data = useMemo(() => balanceSeries(events).slice(-6), [events]);
  const lastIndex = data.length - 1;
  const scale = useMemo(() => niceScale(Math.max(...data.map((d) => d.value), 0)), [data]);

  if (data.length === 0) {
    return <EmptyState title="No history yet" description="Net worth over time will show up here once you log income or expenses." />;
  }
  if (data.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="t-metric text-ink">{formatMoney(data[0].value)}</p>
        <p className="mt-1 text-xs text-ink-muted">{formatDate(data[0].timestamp)} — keep logging to see a trend</p>
      </div>
    );
  }

  return (
    <Plot>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          syncId="home-timeline"
          margin={plotMargin}
          // Each point is a month end, so the entries behind it are that whole
          // month — the balance moved by exactly that much and no more.
          onClick={(state) => {
            const stamp = state?.activeLabel;
            if (typeof stamp !== 'string') return;
            const month = monthKey(stamp);
            openDrill({ title: monthLabel(month), subtitle: 'What moved the balance that month', filter: { month } });
          }}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            {/* Fades to nothing well before the baseline so the fill dissolves
                into the card instead of ending on a visible edge. */}
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
              <stop offset="70%" stopColor={PRIMARY} stopOpacity={0.04} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="timestamp" tickFormatter={(v: string) => formatDate(v)} {...xAxisProps} />
          <YAxis {...yAxisProps} {...(scale ?? {})} />
          <Tooltip
            content={<ChartTooltip labelFormatter={(l) => formatDate(String(l))} valueFormatter={(v) => formatMoney(v)} />}
            cursor={crosshair}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={PRIMARY}
            strokeWidth={2}
            fill="url(#netWorthFill)"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== lastIndex || typeof cx !== 'number' || typeof cy !== 'number') return <g key={`dot-${index}`} />;
              return (
                <g key={`dot-${index}`}>
                  <circle cx={cx} cy={cy} r={4} fill={PRIMARY} stroke={CHART_INK.surface} strokeWidth={2} />
                  <EndpointLabel x={cx} y={cy}>
                    {formatMoney(data[lastIndex].value)}
                  </EndpointLabel>
                </g>
              );
            }}
            activeDot={{ r: 4, fill: PRIMARY, stroke: CHART_INK.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Plot>
  );
}
