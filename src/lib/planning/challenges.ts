import type { LedgerEvent, SpendChallenge } from '../core/types';

/** Current no-spend challenges, latest upsert wins, removals drop out — the
 * same fold shape as goals and debts. */
export function foldChallenges(events: LedgerEvent[]): SpendChallenge[] {
  const byId = new Map<string, SpendChallenge>();
  for (const e of events) {
    if (e.type === 'challenge_upsert') byId.set(e.challenge.id, { ...e.challenge });
    else if (e.type === 'challenge_remove') byId.delete(e.challengeId);
  }
  return Array.from(byId.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export interface BrokenBy {
  category: string;
  amount: number;
}

export interface ChallengeDay {
  date: string; // YYYY-MM-DD
  clean: boolean;
  broken: BrokenBy[];
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export interface ChallengeProgress {
  challenge: SpendChallenge;
  status: ChallengeStatus;
  /** Every day in the window, in order. */
  days: ChallengeDay[];
  /** The subset of `days` that has actually happened yet. */
  elapsed: ChallengeDay[];
  cleanDays: number;
  brokenDays: number;
  /** Consecutive clean days counting back from the most recent elapsed one. */
  currentStreak: number;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * A day-by-day reading of one challenge — purely observational. Nothing
 * about the ledger changes because a challenge exists; this only walks the
 * window it covers and checks, day by day, whether an expense landed in one
 * of the chosen categories.
 */
export function challengeProgress(events: LedgerEvent[], challenge: SpendChallenge, now: Date = new Date()): ChallengeProgress {
  const categories = new Set(challenge.categories);
  const today = dateOnly(now.toISOString());

  const brokenByDate = new Map<string, BrokenBy[]>();
  for (const e of events) {
    if (e.type !== 'expense' || !categories.has(e.category)) continue;
    const date = dateOnly(e.timestamp);
    const list = brokenByDate.get(date) ?? [];
    list.push({ category: e.category, amount: e.amount });
    brokenByDate.set(date, list);
  }

  const days: ChallengeDay[] = [];
  for (let date = challenge.startDate; date <= challenge.endDate; date = addDays(date, 1)) {
    const broken = brokenByDate.get(date) ?? [];
    days.push({ date, clean: broken.length === 0, broken });
  }

  const status: ChallengeStatus = today < challenge.startDate ? 'upcoming' : today > challenge.endDate ? 'ended' : 'active';
  const elapsed = days.filter((d) => d.date <= today);

  let currentStreak = 0;
  for (let i = elapsed.length - 1; i >= 0; i--) {
    if (!elapsed[i].clean) break;
    currentStreak++;
  }

  return {
    challenge,
    status,
    days,
    elapsed,
    cleanDays: elapsed.filter((d) => d.clean).length,
    brokenDays: elapsed.filter((d) => !d.clean).length,
    currentStreak,
  };
}
