import { describe, it, expect } from 'vitest';
import { foldChallenges, challengeProgress } from './challenges';
import type { LedgerEvent, SpendChallenge } from './types';

const challenge: SpendChallenge = {
  id: 'c1',
  label: 'No takeaway',
  categories: ['Takeaway'],
  startDate: '2026-06-01',
  endDate: '2026-06-10',
};

const upsert = (c: SpendChallenge): LedgerEvent => ({ id: `u-${c.id}`, type: 'challenge_upsert', timestamp: '2026-05-25T00:00:00.000Z', challenge: c });
const expense = (id: string, category: string, day: string, amount = 10): LedgerEvent => ({
  id,
  type: 'expense',
  timestamp: `${day}T12:00:00.000Z`,
  amount,
  category,
});

describe('foldChallenges', () => {
  it('keeps the latest upsert and drops removed challenges', () => {
    expect(foldChallenges([upsert(challenge)])).toEqual([challenge]);
    const removed: LedgerEvent[] = [upsert(challenge), { id: 'r', type: 'challenge_remove', timestamp: '2026-05-26T00:00:00.000Z', challengeId: 'c1' }];
    expect(foldChallenges(removed)).toEqual([]);
  });
});

describe('challengeProgress', () => {
  it('is clean every day when nothing was spent in the challenged categories', () => {
    const now = new Date('2026-06-15T00:00:00.000Z'); // window fully over
    const p = challengeProgress([], challenge, now);
    expect(p.status).toBe('ended');
    expect(p.days).toHaveLength(10);
    expect(p.cleanDays).toBe(10);
    expect(p.brokenDays).toBe(0);
    expect(p.currentStreak).toBe(10);
  });

  it('marks a day broken when an expense lands in a challenged category', () => {
    const events = [expense('e1', 'Takeaway', '2026-06-03', 15)];
    const p = challengeProgress(events, challenge, new Date('2026-06-15T00:00:00.000Z'));
    expect(p.brokenDays).toBe(1);
    expect(p.days.find((d) => d.date === '2026-06-03')).toMatchObject({ clean: false, broken: [{ category: 'Takeaway', amount: 15 }] });
  });

  it('ignores spend in a category the challenge does not cover', () => {
    const events = [expense('e1', 'Groceries', '2026-06-03', 40)];
    const p = challengeProgress(events, challenge, new Date('2026-06-15T00:00:00.000Z'));
    expect(p.brokenDays).toBe(0);
  });

  it('only looks at days that have actually happened yet', () => {
    const events = [expense('e1', 'Takeaway', '2026-06-08', 15)]; // day 8, not reached yet
    const p = challengeProgress(events, challenge, new Date('2026-06-05T00:00:00.000Z'));
    expect(p.status).toBe('active');
    expect(p.elapsed).toHaveLength(5); // June 1-5
    expect(p.brokenDays).toBe(0); // the break on the 8th hasn't been reached
  });

  it('reads as upcoming before the window starts', () => {
    expect(challengeProgress([], challenge, new Date('2026-05-01T00:00:00.000Z')).status).toBe('upcoming');
  });

  it('counts the current streak back from the most recent elapsed day, stopping at a break', () => {
    const events = [expense('e1', 'Takeaway', '2026-06-03', 15)];
    // Elapsed through the 6th: 1st,2nd clean, 3rd broken, 4th-6th clean again.
    const p = challengeProgress(events, challenge, new Date('2026-06-06T00:00:00.000Z'));
    expect(p.currentStreak).toBe(3); // 4th, 5th, 6th
  });
});
