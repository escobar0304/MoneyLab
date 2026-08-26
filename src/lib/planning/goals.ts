import type { LedgerEvent, Goal } from '../core/types';
import { monthKey } from '../core/derive';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A month key as a single sortable integer, so month arithmetic is subtraction
 * rather than Date juggling — and immune to the DST traps that bit recurrence. */
function ordinal(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return year * 12 + (m - 1);
}

function fromOrdinal(n: number): string {
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}

/** Current goals, latest upsert wins, removals drop out. */
export function foldGoals(events: LedgerEvent[]): Goal[] {
  const byId = new Map<string, Goal>();
  for (const e of events) {
    if (e.type === 'goal_upsert') byId.set(e.goal.id, { ...e.goal });
    else if (e.type === 'goal_remove') byId.delete(e.goalId);
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Amount earmarked per goal.
 *
 * Contributions to a goal that has since been removed are dropped rather than
 * summed into a phantom total — otherwise deleting a goal would leave its money
 * permanently reserved with nothing on screen to release it.
 */
export function foldContributions(events: LedgerEvent[]): Map<string, number> {
  const live = new Set(foldGoals(events).map((g) => g.id));
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'goal_contribution' || !live.has(e.goalId)) continue;
    totals.set(e.goalId, roundCents((totals.get(e.goalId) ?? 0) + e.amount));
  }
  return totals;
}

/** Everything currently spoken for, across all goals. */
export function totalReserved(events: LedgerEvent[]): number {
  let total = 0;
  for (const amount of foldContributions(events).values()) total += amount;
  return roundCents(total);
}

export type GoalState = 'reached' | 'ahead' | 'behind' | 'no-deadline' | 'new';

export interface GoalProgress {
  goal: Goal;
  saved: number;
  remaining: number;
  /** Share of the target already put aside. Can exceed 1 when overshot. */
  ratio: number;
  /** Average put aside per month so far. Null until there are two months of
   * history — one month is a single data point, not a pace. */
  monthlyPace: number | null;
  /** What it would take per month to arrive by the deadline. Null without one. */
  requiredMonthly: number | null;
  /** Month the current pace arrives, as YYYY-MM. Null when the pace is zero or
   * unknown, because "never" is not a date. */
  projectedMonth: string | null;
  /** Whole months from now until the deadline. Negative once it has passed. */
  monthsLeft: number | null;
  state: GoalState;
}

/**
 * How each goal is doing, and whether the current rate of saving gets there.
 *
 * Pace comes from the goal's own contribution history rather than from overall
 * savings: money saved in general is not money assigned to this goal, and
 * conflating the two would report every goal as on track the moment the month
 * ended in the black.
 */
export function goalProgress(events: LedgerEvent[], now: Date = new Date()): GoalProgress[] {
  const goals = foldGoals(events);
  const contributions = foldContributions(events);
  const nowMonth = monthKey(now.toISOString());
  const nowOrdinal = ordinal(nowMonth);

  // First contribution month per goal, for the pace denominator.
  const firstMonth = new Map<string, string>();
  for (const e of events) {
    if (e.type !== 'goal_contribution') continue;
    const month = monthKey(e.timestamp);
    const current = firstMonth.get(e.goalId);
    if (!current || month < current) firstMonth.set(e.goalId, month);
  }

  return goals.map((goal) => {
    const saved = roundCents(contributions.get(goal.id) ?? 0);
    const remaining = roundCents(Math.max(goal.target - saved, 0));
    const ratio = goal.target > 0 ? saved / goal.target : 0;

    const first = firstMonth.get(goal.id);
    const monthsSaving = first ? nowOrdinal - ordinal(first) + 1 : 0;
    const monthlyPace = monthsSaving >= 2 && saved > 0 ? roundCents(saved / monthsSaving) : null;

    const monthsLeft = goal.targetDate ? ordinal(monthKey(goal.targetDate)) - nowOrdinal : null;
    const requiredMonthly =
      monthsLeft !== null && monthsLeft > 0 && remaining > 0 ? roundCents(remaining / monthsLeft) : null;

    const projectedMonth =
      remaining > 0 && monthlyPace !== null && monthlyPace > 0
        ? fromOrdinal(nowOrdinal + Math.ceil(remaining / monthlyPace))
        : null;

    let state: GoalState;
    if (remaining === 0) state = 'reached';
    else if (monthsLeft === null) state = 'no-deadline';
    else if (monthlyPace === null) state = 'new';
    else if (requiredMonthly === null) state = 'behind'; // deadline reached, still short
    else state = monthlyPace >= requiredMonthly ? 'ahead' : 'behind';

    return { goal, saved, remaining, ratio, monthlyPace, requiredMonthly, projectedMonth, monthsLeft, state };
  });
}
