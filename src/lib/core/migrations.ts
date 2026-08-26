import type { LedgerEvent } from './types';

/** Bump when the on-disk event shape changes, and add a case to `migrateEvent`. */
export const LEDGER_VERSION = 2;

/**
 * Brings a ledger up to the current event shape.
 *
 * Runs in two places that must never disagree: the persist middleware on load,
 * and the import path. An export taken from an old build is exactly as stale as
 * an old localStorage blob, so both go through this same function rather than
 * relying on read-time tolerance scattered across the fold functions.
 *
 * Every case is idempotent and shape-driven rather than version-driven, so a v0
 * ledger passes straight through to v2 in one sweep without needing to know how
 * many versions it skipped.
 */
export function normalizeEvents(events: LedgerEvent[]): LedgerEvent[] {
  return events.map(migrateEvent).filter((e): e is LedgerEvent => e !== null);
}

function migrateEvent(event: LedgerEvent): LedgerEvent | null {
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') return null;

  switch (event.type) {
    // v0 -> the single "salary" became one of several recurring rules.
    case 'salary_upsert':
      return {
        id: event.id,
        type: 'recurring_upsert',
        timestamp: event.timestamp,
        rule: {
          id: event.salary.id,
          kind: 'income',
          label: 'Monthly salary',
          amount: event.salary.amount,
          cycle: 'monthly',
          startDate: event.salary.startDate,
          active: true,
        },
      };

    // v1 -> income and expense rules unified under one type.
    case 'recurring_income_upsert':
      return {
        id: event.id,
        type: 'recurring_upsert',
        timestamp: event.timestamp,
        rule: { ...event.income, kind: 'income' },
      };

    case 'recurring_income_remove':
      return { id: event.id, type: 'recurring_remove', timestamp: event.timestamp, recurringId: event.incomeId };

    case 'recurring_income_skip':
      return { id: event.id, type: 'recurring_skip', timestamp: event.timestamp, recurringId: event.recurringId, month: event.month };

    // v0 -> payments referenced their source as `salaryId`.
    case 'income':
      if (event.salaryId && !event.recurringId) {
        const { salaryId, ...rest } = event;
        return { ...rest, recurringId: salaryId };
      }
      return event;

    default:
      return event;
  }
}

/**
 * Merges an imported ledger into the existing one, keyed by event id.
 *
 * Ids are stable and generated per event, so the same event imported twice is
 * the same id — which makes this safe to run repeatedly and lets two devices be
 * reconciled without either one losing entries. Replacing wholesale, the old
 * behaviour, silently discarded anything the other side had.
 */
export function mergeEvents(
  existing: LedgerEvent[],
  incoming: LedgerEvent[]
): { merged: LedgerEvent[]; added: number; duplicates: number } {
  const byId = new Map(existing.map((e) => [e.id, e]));
  let added = 0;
  let duplicates = 0;

  for (const event of normalizeEvents(incoming)) {
    if (byId.has(event.id)) duplicates++;
    else {
      byId.set(event.id, event);
      added++;
    }
  }

  const merged = Array.from(byId.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { merged, added, duplicates };
}
