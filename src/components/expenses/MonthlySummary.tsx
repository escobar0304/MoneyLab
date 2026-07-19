import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { spendByCategoryForMonth, previousMonthKey, monthsWithActivity } from '../../lib/derive';
import { Badge, Card, EmptyState, Select, SectionTitle } from '../ui/primitives';
import { formatSignedMoney, monthLabel } from '../../lib/format';

export function MonthlySummary() {
  const events = useStore((s) => s.events);
  const months = useMemo(() => monthsWithActivity(events), [events]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const selectableMonths = months.includes(currentMonth) ? months : [...months, currentMonth].sort();

  const thisMonth = useMemo(() => spendByCategoryForMonth(events, month), [events, month]);
  const lastMonth = useMemo(() => spendByCategoryForMonth(events, previousMonthKey(month)), [events, month]);
  const categories = Array.from(new Set([...Object.keys(thisMonth), ...Object.keys(lastMonth)])).sort();

  return (
    <Card>
      <SectionTitle
        action={
          <Select className="w-40" value={month} onChange={(e) => setMonth(e.target.value)}>
            {selectableMonths.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        }
      >
        Monthly summary
      </SectionTitle>

      {categories.length === 0 ? (
        <EmptyState title="No expenses logged this month" />
      ) : (
        <div className="space-y-2">
          {categories.map((c) => {
            const cur = thisMonth[c] ?? 0;
            const prev = lastMonth[c] ?? 0;
            const delta = cur - prev;
            return (
              <div key={c} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-2.5">
                <span className="truncate text-sm font-medium text-neutral-100">{c}</span>
                <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
                  <span>vs {formatSignedMoney(prev)} last month</span>
                  {delta !== 0 && (
                    <Badge tone={delta > 0 ? 'bad' : 'good'}>
                      {delta > 0 ? '+' : ''}
                      {formatSignedMoney(delta)}
                    </Badge>
                  )}
                  <span className="w-16 text-right font-medium tabular-nums text-neutral-100">{formatSignedMoney(cur)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
