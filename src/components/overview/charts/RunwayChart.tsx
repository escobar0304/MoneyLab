import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, useVisibleEvents } from '../../../lib/core/store';
import { projectRunway, type RunwayDay } from '../../../lib/planning/runway';
import { formatMoney } from '../../../lib/core/format';
import { PRIMARY, COMPLEMENT, CHART_INK } from '../../../lib/insight/chartTheme';
import { ChartLegend, Plot, crosshair, gridProps, plotMargin, xAxisProps, yAxisProps, niceSpan } from '../../ui/chartChrome';
import { EmptyState } from '../../ui/primitives';

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The tooltip carries what actually lands that day, which is the reason to
 * hover at all — a balance alone doesn't say why it moved. */
function RunwayTooltip({ active, payload }: { active?: boolean; payload?: { payload?: RunwayDay }[] }) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs float-material">
      <p className="mb-1.5 text-ink-muted">{shortDate(day.date)}</p>
      <p className="font-semibold text-ink">{formatMoney(day.expected)}</p>
      {day.items.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-hairline pt-1.5">
          {day.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span style={{ color: item.kind === 'income' ? PRIMARY : COMPLEMENT }}>{item.kind === 'income' ? '+' : '−'}</span>
              <span className="num-col text-ink-secondary">{formatMoney(item.amount)}</span>
              <span className="text-ink-muted">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The balance day by day for the weeks ahead.
 *
 * The monthly forecast says how the month ends. This says whether you get
 * there, which is a different question: rent on the 1st and salary on the 28th
 * net out to a comfortable month and a very uncomfortable 20th.
 *
 * Two lines with different certainties. The filled one adds day-to-day spending
 * continuing at its usual rate and is the one to read; the faint one is what is
 * contractually scheduled and nothing else, shown so the gap between them is
 * visible as the assumption it is.
 */
export function RunwayChart({ days = 60 }: { days?: number }) {
  const events = useVisibleEvents();
  const asOf = useStore((s) => s.asOf);
  // Projecting forward from the date being viewed, not from today — otherwise a
  // time-travelled dashboard would show a past balance running into a future
  // month's bills, which is a chart of nothing.
  const runway = useMemo(
    () => projectRunway(events, { days, now: asOf ? new Date(`${asOf}T12:00:00.000Z`) : undefined }),
    [events, days, asOf]
  );

  if (runway.days.length === 0) {
    return <EmptyState title="Nothing to project" description="Log some income and expenses first." />;
  }

  const values = runway.days.flatMap((d) => [d.expected, d.scheduled]);
  const scale = niceSpan(Math.min(...values, 0), Math.max(...values, 0));

  return (
    <Plot>
      <ChartLegend
        payload={[
          { value: 'If spending carries on', color: PRIMARY },
          { value: 'Scheduled only', color: CHART_INK.muted },
        ]}
      />
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={runway.days} margin={plotMargin}>
          <defs>
            <linearGradient id="runwayFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.2} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...xAxisProps} minTickGap={44} />
          <YAxis {...yAxisProps} domain={scale.domain} ticks={scale.ticks} />
          {/* Zero is the only threshold on this chart that means something on
              its own, so it is drawn whether or not the line reaches it. */}
          <ReferenceLine y={0} stroke={CHART_INK.axis} strokeWidth={1} />
          <Tooltip cursor={crosshair} content={<RunwayTooltip />} />

          {/* Both areas draw instantly, which looks like an oversight and is not.
              Recharts tweens an Area over ~1.5s but renders ReferenceDot at its
              final position immediately — so with the animation on, the orange
              shortfall marker sits alone in empty space for the better part of a
              second before the line that explains it arrives. Measured at 160ms
              into the tween: the area had reached Oct 2 while the marker was
              already at Oct 17. A lone dot in the void reads as a bug, and this
              is the most prominent chart in the app. */}
          <Area
            type="stepAfter"
            dataKey="scheduled"
            stroke={CHART_INK.muted}
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="none"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="stepAfter"
            dataKey="expected"
            stroke={PRIMARY}
            strokeWidth={2}
            fill="url(#runwayFill)"
            dot={false}
            activeDot={{ r: 4, fill: PRIMARY, stroke: CHART_INK.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />

          {/* The one point worth finding on the whole chart. */}
          {runway.shortfall && (
            <ReferenceDot
              x={runway.shortfall.date}
              y={runway.shortfall.expected}
              r={4}
              fill={COMPLEMENT}
              stroke={CHART_INK.surface}
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Plot>
  );
}

/** The sentence version of the chart, for the card header. */
export function RunwaySummary({ days = 60 }: { days?: number }) {
  const events = useVisibleEvents();
  const asOf = useStore((s) => s.asOf);
  // Projecting forward from the date being viewed, not from today — otherwise a
  // time-travelled dashboard would show a past balance running into a future
  // month's bills, which is a chart of nothing.
  const runway = useMemo(
    () => projectRunway(events, { days, now: asOf ? new Date(`${asOf}T12:00:00.000Z`) : undefined }),
    [events, days, asOf]
  );

  // The verdict is stated whatever the assumptions are. Hiding it when there is
  // no spending history would drop the low point — the most useful thing here —
  // exactly when the projection is at its most certain.
  return (
    <p className="text-xs text-ink-muted">
      {runway.shortfall ? (
        <span className="text-critical-text">
          Runs out in <strong>{runway.daysOfRunway} days</strong>, on {shortDate(runway.shortfall.date)}.
        </span>
      ) : (
        <>
          Stays positive for the next {days} days. Lowest point{' '}
          <span className="num-col text-ink-secondary">{formatMoney(runway.trough?.expected ?? 0)}</span> on{' '}
          {shortDate(runway.trough?.date ?? '')}.
        </>
      )}{' '}
      {runway.dailyPace === 0 ? (
        'Scheduled items only — no day-to-day spending recorded yet.'
      ) : (
        <>
          Assumes <span className="num-col text-ink-secondary">{formatMoney(runway.dailyPace)}</span> a day
          {!runway.reliable && ', from very little history'}.
        </>
      )}
    </p>
  );
}
