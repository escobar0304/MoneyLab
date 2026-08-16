import { useMemo, useState } from 'react';
import { useStore, useCleared, useAccounts, useVisibleEvents } from '../../lib/store';
import { selectEntries, drillTotals } from '../../lib/drill';
import { accountIdOf, MAIN_ACCOUNT_ID } from '../../lib/accounts';
import { categoryColorMap } from '../../lib/chartTheme';
import { formatMoney } from '../../lib/format';
import { EmptyState, Modal } from '../ui/primitives';
import { EntryRow } from './EntryList';
import { EntryDetail } from './EntryDetail';

/**
 * The entries behind whichever chart mark was clicked.
 *
 * Mounted once, at the app root, and driven entirely by one field on the store.
 * Every chart in the app therefore gains drill-down by calling `openDrill` and
 * saying what its mark meant — no chart has to know this panel exists, and there
 * is exactly one of it however many marks are on screen.
 *
 * Reads the same `useVisibleEvents` the charts do, so drilling into a mark while
 * time-travelling opens the entries that mark was actually drawn from rather
 * than today's.
 */
export function DrillPanel() {
  const drill = useStore((s) => s.drill);
  const closeDrill = useStore((s) => s.closeDrill);
  const events = useVisibleEvents();
  const cleared = useCleared();
  const accounts = useAccounts();
  const colors = useMemo(() => categoryColorMap(events), [events]);
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(() => (drill ? selectEntries(events, drill.filter) : []), [events, drill]);
  const totals = useMemo(() => drillTotals(entries), [entries]);
  const open = entries.find((e) => e.id === openId) ?? null;

  if (!drill) return null;

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.label;
  // Only worth a column once the balance is actually divided; before that it is
  // the word "Main" repeated down the page.
  const showAccounts = accounts.length > 1 && drill.filter.accountId === undefined;

  return (
    <>
      <Modal
        title={drill.title}
        width="lg"
        onClose={() => {
          setOpenId(null);
          closeDrill();
        }}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-hairline pb-3">
          <p className="t-caption">{drill.subtitle}</p>
          {/* The sums are the reason to open this at all: they are what the mark
              claimed, now shown as the rows that make it up. */}
          <p className="flex flex-wrap items-baseline gap-3 text-xs">
            {totals.expense > 0 && <span className="num-col text-complement">−{formatMoney(totals.expense)}</span>}
            {totals.income > 0 && <span className="num-col text-positive">+{formatMoney(totals.income)}</span>}
            <span className="text-ink-muted">
              {totals.count} {totals.count === 1 ? 'entry' : 'entries'}
            </span>
          </p>
        </div>

        {entries.length === 0 ? (
          <EmptyState title="Nothing here" description="Everything matching this has since been edited or deleted." />
        ) : (
          <ul className="max-h-[55vh] divide-y divide-hairline overflow-y-auto">
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                color={entry.type === 'expense' ? colors.get(entry.category) : undefined}
                // Always dated: a drilled slice can span a range, and even
                // within one month the day is the thing that identifies a row.
                showDate
                accountLabel={showAccounts && accountIdOf(entry) !== MAIN_ACCOUNT_ID ? accountName(accountIdOf(entry)) : undefined}
                cleared={cleared.has(entry.id)}
                onOpen={() => setOpenId(entry.id)}
              />
            ))}
          </ul>
        )}
      </Modal>

      {/* Stacked on top rather than replacing the list, so closing the entry
          returns you to the slice you found it in. */}
      {open && <EntryDetail entry={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
