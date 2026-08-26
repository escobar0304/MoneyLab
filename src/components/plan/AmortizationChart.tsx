import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { amortize } from '../../lib/planning/debt';
import type { Debt } from '../../lib/core/types';
import { monthKey } from '../../lib/core/derive';
import { formatMoney, monthLabel } from '../../lib/core/format';
import { PRIMARY, COMPLEMENT, CHART_INK } from '../../lib/insight/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { ChartLegend, Plot, crosshair, gridProps, plotMargin, xAxisProps, yAxisProps } from '../ui/chartChrome';
import { EmptyState } from '../ui/primitives';

/**
 * Where each payment actually goes, month by month.
 *
 * The single most useful thing to see about a loan, and the one a monthly
 * payment figure hides completely: early on almost the whole instalment is
 * interest, and the crossover — the month capital finally overtakes it — is
 * years in. Stacked to the payment total, so the band heights are the split and
 * the outline is the instalment.
 */
export function AmortizationChart({ debt }: { debt: Debt }) {
  const data = useMemo(
    () => amortize(debt).map((row) => ({ month: row.month, interest: row.interest, principal: row.principal })),
    [debt]
  );

  if (data.length < 2) {
    return <EmptyState title="Nothing to plot" description="Check the amount, rate and term — this loan produces no schedule." />;
  }

  const today = monthKey(new Date().toISOString());
  const withinSchedule = today >= data[0].month && today <= data[data.length - 1].month;

  return (
    <Plot>
      <ChartLegend payload={[{ value: 'Interest', color: COMPLEMENT }, { value: 'Capital', color: PRIMARY }]} />
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={plotMargin}>
          <CartesianGrid {...gridProps} />
          {/* Only the year: 360 month labels would be unreadable, and the year
              is the unit anyone thinks about a mortgage in anyway. */}
          <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 4)} {...xAxisProps} minTickGap={40} />
          <YAxis {...yAxisProps} />
          <Tooltip
            cursor={crosshair}
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} valueFormatter={(v) => formatMoney(v)} />}
          />
          {withinSchedule && (
            <ReferenceLine
              x={today}
              stroke={CHART_INK.axis}
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: 'now', position: 'insideTopRight', fill: CHART_INK.muted, fontSize: 11 }}
            />
          )}
          <Area type="monotone" dataKey="interest" name="Interest" stackId="p" stroke={COMPLEMENT} strokeWidth={1.5} fill={COMPLEMENT} fillOpacity={0.22} />
          <Area type="monotone" dataKey="principal" name="Capital" stackId="p" stroke={PRIMARY} strokeWidth={1.5} fill={PRIMARY} fillOpacity={0.18} />
        </AreaChart>
      </ResponsiveContainer>
    </Plot>
  );
}
