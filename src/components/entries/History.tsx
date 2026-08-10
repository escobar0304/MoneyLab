import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { monthsWithActivity, monthKey, totalIncomeForMonth, totalOutflowForMonth } from '../../lib/derive';
import { Card, EmptyState, SectionTitle, Select } from '../ui/primitives';
import { formatMoney, formatDate, monthLabel } from '../../lib/format';
import { formatForeign } from '../../lib/currency';
import { categoryColorMap } from '../../lib/chartTheme';
import { listReceiptIds } from '../../lib/receipts';
import { isMoneyEvent, type MoneyEvent } from '../../lib/types';
import { EntryDetail } from './EntryDetail';

/**
 * The full ledger, browsable by month.
 *
 * This replaces a "last 12 entries" list, which quietly hid everything older —
 * the data was always stored, but there was no way to reach it, so an earlier
 * month looked like it had been lost. Rows open a detail overlay rather than
 * trying to show everything inline, where notes and subcategories only ever got
 * truncated away.
 */
export function History() {
  const events = useStore((s) => s.events);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const currentMonth = monthKey(new Date().toISOString());
  const months = useMemo(() => {
    const active = monthsWithActivity(events);
    return (active.includes(currentMonth) ? active : [...active, currentMonth]).sort().reverse();
  }, [events, currentMonth]);

  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [withReceipts, setWithReceipts] = useState<Set<string>>(new Set());

  // Only the ids, so the list can badge rows without decoding every image.
  useEffect(() => {
    listReceiptIds()
      .then(setWithReceipts)
      .catch(() => setWithReceipts(new Set()));
  }, [events, openId]);

  const entries = useMemo(
    () =>
      events
        .filter(isMoneyEvent)
        .filter((e) => monthKey(e.timestamp) === month)
        .filter((e) => filter === 'all' || e.type === filter)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [events, month, filter]
  );

  const income = totalIncomeForMonth(events, month);
  const spend = totalOutflowForMonth(events, month);
  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <Card>
      <SectionTitle
        action={
          <div className="w-44">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        History
      </SectionTitle>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-surface-0 p-0.5">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-200 ${
                filter === f ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          <span className="num-col text-positive">+{formatMoney(income)}</span> ·{' '}
          <span className="num-col text-complement">−{formatMoney(spend)}</span> · {entries.length} entr
          {entries.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState title={`Nothing logged in ${monthLabel(month)}`} />
      ) : (
        <ul className="divide-y divide-hairline">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              color={entry.type === 'expense' ? colors.get(entry.category) : undefined}
              hasReceipt={withReceipts.has(entry.id)}
              onOpen={() => setOpenId(entry.id)}
            />
          ))}
        </ul>
      )}

      {open && <EntryDetail entry={open} onClose={() => setOpenId(null)} />}
    </Card>
  );
}

function EntryRow({
  entry,
  color,
  hasReceipt,
  onOpen,
}: {
  entry: MoneyEvent;
  color?: string;
  hasReceipt: boolean;
  onOpen: () => void;
}) {
  const isIncome = entry.type === 'income';
  const detail = [
    formatDate(entry.timestamp),
    !isIncome ? entry.subcategory : null,
    !isIncome ? entry.note : null,
    entry.foreign ? formatForeign(entry.foreign.originalAmount, entry.foreign.currency) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      {/* The whole row is the control. A detail view reached only by hunting for
          a small icon may as well not exist. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${isIncome ? entry.label : entry.category}, ${formatMoney(entry.amount)}`}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-surface-2/60"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: isIncome ? 'var(--color-positive)' : (color ?? 'var(--color-ink-muted)') }}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm text-ink-secondary">{isIncome ? entry.label : entry.category}</span>
              {hasReceipt && (
                <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-ink-muted" fill="currentColor" role="img" aria-label="Has receipt">
                  <path d="M4 1h8a1 1 0 0 1 1 1v13l-2.2-1.4L8.6 15 6.4 13.6 4.2 15 3 15V2a1 1 0 0 1 1-1Zm1.5 3.2a.7.7 0 0 0 0 1.4h5a.7.7 0 0 0 0-1.4h-5Zm0 3a.7.7 0 0 0 0 1.4h5a.7.7 0 0 0 0-1.4h-5Z" />
                </svg>
              )}
            </span>
            <span className="block truncate text-xs text-ink-muted">{detail}</span>
          </span>
        </span>

        <span className={`num-col shrink-0 text-sm font-medium ${isIncome ? 'text-positive' : 'text-ink-secondary'}`}>
          {isIncome ? '+' : '−'}
          {formatMoney(entry.amount)}
        </span>
      </button>
    </li>
  );
}
