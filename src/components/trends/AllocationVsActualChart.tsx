import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, useBuckets } from '../../lib/store';
import { bucketVarianceForMonth, monthsWithActivity } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CHART_INK, STATUS } from '../../lib/chartTheme';
import { EmptyState, Select } from '../ui/primitives';

export function AllocationVsActualChart() {
  const events = useStore((s) => s.events);
  const buckets = useBuckets();
  const months = useMemo(() => monthsWithActivity(events), [events]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const selectableMonths = months.includes(currentMonth) ? months : [...months, currentMonth].sort();

  const data = useMemo(() => {
    const active = buckets.filter((b) => !b.archived && b.kind !== 'unallocated');
    return bucketVarianceForMonth(events, active, month)
      .filter((v) => v.allocated !== 0 || v.actual !== 0)
      .map((v) => ({ name: active.find((b) => b.id === v.bucketId)?.name ?? 'Unknown', variance: v.variance }));
  }, [events, buckets, month]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: STATUS.good }} /> Under budget
          <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: STATUS.critical }} /> Over budget
        </p>
        <Select className="w-40" value={month} onChange={(e) => setMonth(e.target.value)}>
          {selectableMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No allocation activity for this month" />
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={CHART_INK.gridline} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatMoney(v)}
                stroke={CHART_INK.axis}
                tick={{ fill: CHART_INK.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_INK.axis }}
              />
              <YAxis type="category" dataKey="name" stroke={CHART_INK.axis} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} tickLine={false} axisLine={false} width={110} />
              <ReferenceLine x={0} stroke={CHART_INK.axis} />
              <Tooltip formatter={(value) => [formatMoney(Number(value) || 0), 'Variance']} contentStyle={{ borderRadius: 6, borderColor: CHART_INK.gridline, fontSize: 12 }} />
              <Bar dataKey="variance" radius={[0, 3, 3, 0]}>
                {data.map((d) => (
                  <Cell key={d.name} fill={d.variance < 0 ? STATUS.critical : STATUS.good} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
