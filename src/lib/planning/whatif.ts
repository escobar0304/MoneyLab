import type { LedgerEvent, RecurringKind } from '../core/types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * One hypothetical change, entered by hand rather than picked from real
 * history — a raise not yet negotiated, a subscription not yet cancelled.
 *
 * `recurring` and `oneOff` share `direction`/`amount`/`label` on purpose,
 * the same way a real recurring rule and a real entry do: the only thing
 * that differs is whether it repeats.
 */
export type WhatIfAdjustment =
  | { id: string; kind: 'recurring'; direction: RecurringKind; label: string; amount: number }
  | { id: string; kind: 'cancel'; recurringId: string; direction: RecurringKind; label: string; amount: number }
  | { id: string; kind: 'oneOff'; direction: RecurringKind; label: string; amount: number };

/**
 * Turns a list of hypothetical adjustments into synthetic ledger events on
 * top of a *copy* of the real ledger — the real `events` array, and the
 * store behind it, are never touched.
 *
 * This is deliberately not a new kind of arithmetic: every derive/analysis
 * function in this app already just takes `events: LedgerEvent[]` and
 * computes from it, which is the same trick Time Travel uses to show the
 * dashboard as it stood on a past date. A "what if" is that same trick
 * pointed at a future the ledger doesn't contain yet.
 */
export function applyWhatIf(events: LedgerEvent[], adjustments: WhatIfAdjustment[], now: Date = new Date()): LedgerEvent[] {
  const out = [...events];
  const timestamp = now.toISOString();
  const startDate = timestamp.slice(0, 10);

  for (const adj of adjustments) {
    const id = `whatif-${adj.id}`;
    if (adj.kind === 'recurring') {
      out.push({
        id,
        type: 'recurring_upsert',
        timestamp,
        rule: { id, kind: adj.direction, label: adj.label, amount: adj.amount, cycle: 'monthly', startDate, active: true },
      });
    } else if (adj.kind === 'cancel') {
      out.push({ id, type: 'recurring_remove', timestamp, recurringId: adj.recurringId });
    } else if (adj.direction === 'income') {
      out.push({ id, type: 'income', timestamp, amount: adj.amount, label: adj.label });
    } else {
      out.push({ id, type: 'expense', timestamp, amount: adj.amount, category: adj.label });
    }
  }

  return out;
}

/**
 * The steady effect on next month's balance, independent of any day-by-day
 * projection — the number that answers "how much does this change my
 * month by" on its own. One-offs move the balance once, not every month, so
 * they don't count here.
 */
export function monthlyEffect(adjustments: WhatIfAdjustment[]): number {
  let total = 0;
  for (const adj of adjustments) {
    if (adj.kind === 'oneOff') continue;
    const sign = adj.direction === 'income' ? 1 : -1;
    // Cancelling frees up (or loses) exactly what the rule used to move —
    // the opposite sign of adding that same rule fresh.
    total += (adj.kind === 'cancel' ? -1 : 1) * sign * adj.amount;
  }
  return roundCents(total);
}
