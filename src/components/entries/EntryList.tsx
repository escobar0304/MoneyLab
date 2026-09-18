import { useRef } from 'react';
import { formatMoney, formatDate, monthLabel } from '../../lib/core/format';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/core/animation';
import { formatForeign } from '../../lib/core/currency';
import { monthKey } from '../../lib/core/derive';
import type { MoneyEvent } from '../../lib/core/types';

/**
 * One entry, as a row.
 *
 * Shared rather than local to the history, because a chart mark opened into its
 * entries has to render them identically — the whole promise of drilling down is
 * that you land on the same rows you would have found by hand, and two
 * implementations of "an entry" would quietly stop agreeing about which fields
 * an entry even has.
 */
export function EntryRow({
  entry,
  color,
  hasReceipt = false,
  showDate,
  accountLabel,
  selecting = false,
  selected = false,
  onSelect,
  cleared = false,
  onOpen,
  arrived = false,
}: {
  entry: MoneyEvent;
  color?: string;
  hasReceipt?: boolean;
  showDate: boolean;
  /** Shown only when there is more than one account — until then it is a column
   * of the same word repeated. */
  accountLabel?: string;
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  cleared?: boolean;
  onOpen: () => void;
  /** Set on a row that appeared since the last render, so the one entry the
   * reader just logged announces itself instead of silently existing. */
  arrived?: boolean;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const isIncome = entry.type === 'income';

  // Height as well as opacity: a row fading in on top of a list that has
  // already reflowed reads as a glitch, because everything below it jumped
  // first and the new row arrived afterwards into a gap it did not make.
  useGSAP(
    () => {
      if (!arrived || prefersReducedMotion() || !rowRef.current) return;
      gsap.from(rowRef.current, {
        height: 0,
        opacity: 0,
        duration: DUR.base,
        ease: EASE.out,
        // Height is animated from 0, so whatever the row's own padding is must
        // collapse with it or the tween starts taller than nothing.
        paddingTop: 0,
        paddingBottom: 0,
        clearProps: 'height,opacity,paddingTop,paddingBottom',
      });
    },
    { dependencies: [arrived] }
  );
  const detail = [
    formatDate(entry.timestamp),
    !isIncome && entry.splitCount ? `${entry.splitIndex} of ${entry.splitCount}` : null,
    !isIncome ? entry.subcategory : null,
    !isIncome ? entry.note : null,
    accountLabel,
    entry.foreign ? formatForeign(entry.foreign.originalAmount, entry.foreign.currency) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li ref={rowRef} className="flex items-center gap-2">
      {selecting && (
        // Its own control, outside the row button: ticking forty entries against
        // a statement should not open forty overlays on the way.
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${isIncome ? entry.label : entry.category}, ${formatMoney(entry.amount)}`}
          className="ml-1 h-4 w-4 shrink-0 cursor-pointer accent-accent"
        />
      )}
      {/* The whole row is the control. A detail view reached only by hunting for
          a small icon may as well not exist. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${isIncome ? entry.label : entry.category}, ${formatMoney(entry.amount)}`}
        className="row-pad flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-md px-1 text-left transition-colors hover:bg-surface-2/60"
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
              {/* The tick stays visible outside selection mode, so a verified
                  ledger looks different from one nobody has checked. */}
              {cleared && (
                <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-positive" fill="currentColor" role="img" aria-label="Cleared">
                  <path d="M6.2 11.8 2.6 8.2l1.2-1.2 2.4 2.4 5.9-5.9 1.3 1.2z" />
                </svg>
              )}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              {showDate ? `${monthLabel(monthKey(entry.timestamp))} · ${detail}` : detail}
            </span>
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
