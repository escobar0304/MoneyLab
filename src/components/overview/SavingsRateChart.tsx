import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useVisibleEvents, useStore } from '../../lib/store';
import { savingsRateSeries } from '../../lib/analysis';
import { monthLabel } from '../../lib/format';
import { CHART_INK, PRIMARY } from '../../lib/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EndpointLabel, Plot, crosshair, gridProps, niceSpan, plotMargin, xAxisProps } from '../ui/chartChrome';
import { EmptyState } from '../ui/primitives';

/**
 * The share of income kept, month by month.
 *
 * A percentage rather than an amount: the amount saved climbs whenever income
 * climbs, which flatters a month where nothing actually changed. The zero line
 * is drawn because crossing it — spending more than you earned — is the only
 * threshold on this chart that means something on its own.
 */
export function SavingsRateChart() {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);

  const data = useMemo(
    () =>
      savingsRateSeries(events)
        .filter((p) => p.rate !== null)
        .slice(-12)
        .map((p) => ({ month: p.month, rate: p.rate as number })),
    [events]
  );

  if (data.length < 2) {
    return <EmptyState title="Not enough history yet" description="Two months of income and spending are needed to show a trend." />;
  }

  const last = data[data.length - 1];
  // Zero is always included: crossing it is the one threshold on this chart
  // that means something on its own.
  const scale = niceSpan(Math.min(...data.map((d) => d.rate), 0), Math.max(...data.map((d) => d.rate), 0));

  return (
    <Plot height={200}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={plotMargin}
          onClick={(state) => {
            const month = state?.activeLabel;
            if (typeof month === 'string') {
              openDrill({ title: monthLabel(month), subtitle: 'The income and spending behind that rate', filter: { month } });
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
              <stop offset="70%" stopColor={PRIMARY} stopOpacity={0.04} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" tickFormatter={(v: string) => monthLabel(v).split(' ')[0]} {...xAxisProps} />
          <YAxis
            {...{ stroke: 'transparent', tickLine: false, axisLine: false, width: 46 }}
            tick={{ fill: CHART_INK.muted, fontSize: 11, fontFamily: 'inherit' }}
            domain={scale.domain}
            ticks={scale.ticks}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
          />
          <ReferenceLine y={0} stroke={CHART_INK.axis} strokeWidth={1} />
          <Tooltip
            cursor={crosshair}
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} valueFormatter={(v) => `${v.toFixed(1)}% saved`} />}
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke={PRIMARY}
            strokeWidth={2}
            fill="url(#savingsFill)"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1 || typeof cx !== 'number' || typeof cy !== 'number') return <g key={`d-${index}`} />;
              return (
                <g key={`d-${index}`}>
                  <circle cx={cx} cy={cy} r={4} fill={PRIMARY} stroke={CHART_INK.surface} strokeWidth={2} />
                  <EndpointLabel x={cx} y={cy}>{`${last.rate.toFixed(0)}%`}</EndpointLabel>
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
