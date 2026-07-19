import { useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useStore } from '../../lib/store';
import { totalIncomeForMonth, totalOutflowForMonth, monthsWithActivity } from '../../lib/derive';
import { monthLabel, formatMoney } from '../../lib/format';
import { CATEGORICAL, CHART_INK } from '../../lib/chartTheme';
import { EmptyState, Select } from '../ui/primitives';

export function SpentVsRemainingPie() {
  const events = useStore((s) => s.events);
  const months = useMemo(() => monthsWithActivity(events), [events]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const selectableMonths = months.includes(currentMonth) ? months : [...months, currentMonth].sort();

  const { income, spent, remaining, overspent } = useMemo(() => {
    const income = totalIncomeForMonth(events, month);
    const spent = totalOutflowForMonth(events, month);
    return { income, spent, remaining: Math.max(income - spent, 0), overspent: spent > income };
  }, [events, month]);

  const data = [
    { name: 'Spent', value: overspent ? income : spent },
    { name: 'Remaining', value: remaining },
  ].filter((d) => d.value > 0);

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
      {income === 0 ? (
        <EmptyState title="No income logged this month" />
      ) : (
        <>
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
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.name === 'Spent' ? CATEGORICAL[5] : CATEGORICAL[1]} />
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
          {overspent && <p className="text-center text-xs text-red-400">Spent {formatMoney(spent - income)} more than you earned this month</p>}
        </>
      )}
    </div>
  );
}
