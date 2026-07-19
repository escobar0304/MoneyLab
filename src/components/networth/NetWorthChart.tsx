import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NetWorthPoint } from '../../lib/derive';
import { CHART_INK, SEQUENTIAL_BLUE } from '../../lib/chartTheme';
import { formatMoney, formatDate } from '../../lib/format';
import { EmptyState } from '../ui/primitives';

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: NetWorthPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-neutral-900">{formatMoney(point.value)}</p>
      <p className="text-neutral-500">{formatDate(point.timestamp)}</p>
    </div>
  );
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="No net worth snapshots yet" description="Log your net worth to start a trend line." />;
  }
  if (data.length === 1) {
    return (
      <div className="py-6 text-center">
        <p className="text-3xl font-semibold tabular-nums text-neutral-900">{formatMoney(data[0].value)}</p>
        <p className="mt-1 text-xs text-neutral-500">{formatDate(data[0].timestamp)} — log another snapshot to see a trend</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_INK.axis, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={SEQUENTIAL_BLUE}
            strokeWidth={2}
            fill="url(#netWorthFill)"
            dot={false}
            activeDot={{ r: 4, fill: SEQUENTIAL_BLUE, stroke: CHART_INK.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
