import { useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '../../lib/store';
import { spendByCategoryForMonth, monthsWithActivity } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CATEGORICAL, CHART_INK } from '../../lib/chartTheme';
import { EmptyState, Select } from '../ui/primitives';

export function SpendByCategoryPie() {
  const events = useStore((s) => s.events);
  const months = useMemo(() => monthsWithActivity(events), [events]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const selectableMonths = months.includes(currentMonth) ? months : [...months, currentMonth].sort();

  const data = useMemo(() => {
    const byCategory = spendByCategoryForMonth(events, month);
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [events, month]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Select className="w-40" value={month} onChange={(e) => setMonth(e.target.value)}>
          {selectableMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
      </div>
      {data.length === 0 ? (
        <EmptyState title="No expenses this month" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={i < CATEGORICAL.length ? CATEGORICAL[i] : CHART_INK.muted} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value) || 0), name]}
                contentStyle={{ borderRadius: 6, background: '#232322', borderColor: '#383835', fontSize: 12, color: CHART_INK.primary }}
                itemStyle={{ color: CHART_INK.primary }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.secondary }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
