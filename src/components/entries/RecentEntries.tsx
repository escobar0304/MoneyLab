import { useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Card, EmptyState, SectionTitle } from '../ui/primitives';
import { formatMoney, formatDate } from '../../lib/format';
import type { LedgerEvent } from '../../lib/types';

/** Confirmation that what you just typed landed, and in the right month. */
export function RecentEntries() {
  const events = useStore((s) => s.events);

  const recent = useMemo(
    () =>
      events
        .filter((e): e is Extract<LedgerEvent, { type: 'income' | 'expense' }> => e.type === 'income' || e.type === 'expense')
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 12),
    [events]
  );

  return (
    <Card>
      <SectionTitle>Recent entries</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <ul className="divide-y divide-neutral-800/70">
          {recent.map((e) => {
            const isIncome = e.type === 'income';
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${isIncome ? 'bg-emerald-400' : 'bg-neutral-600'}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-200">{isIncome ? e.label : e.category}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {formatDate(e.timestamp)}
                      {!isIncome && e.subcategory ? ` · ${e.subcategory}` : ''}
                      {!isIncome && e.note ? ` · ${e.note}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`num-col shrink-0 text-sm font-medium ${isIncome ? 'text-emerald-400' : 'text-neutral-200'}`}>
                  {isIncome ? '+' : '−'}
                  {formatMoney(e.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
