import { describe, it, expect } from 'vitest';
import { foldGoals, foldContributions, totalReserved, goalProgress } from './goals';
import type { Goal, LedgerEvent } from '../core/types';

const goal = (over: Partial<Goal> = {}): Goal => ({ id: 'g1', label: 'Emergency fund', target: 6000, ...over });

let seq = 0;
const upsert = (g: Goal): LedgerEvent => ({ id: `e${seq++}`, type: 'goal_upsert', timestamp: '2026-01-01T00:00:00.000Z', goal: g });
const put = (goalId: string, amount: number, date: string): LedgerEvent => ({
  id: `e${seq++}`,
  type: 'goal_contribution',
  timestamp: date,
  goalId,
  amount,
});

const NOW = new Date('2026-08-10T12:00:00.000Z');

describe('foldGoals', () => {
  it('applies the latest upsert and drops removals', () => {
    const events: LedgerEvent[] = [
      upsert(goal({ id: 'a', target: 1000 })),
      upsert(goal({ id: 'b', label: 'Trip' })),
      upsert(goal({ id: 'a', target: 2000 })),
      { id: 'r', type: 'goal_remove', timestamp: '2026-02-01T00:00:00.000Z', goalId: 'b' },
    ];
    const goals = foldGoals(events);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ id: 'a', target: 2000 });
  });
});

describe('foldContributions', () => {
  it('sums contributions and nets off releases', () => {
    const events = [upsert(goal()), put('g1', 500, '2026-01-05T00:00:00.000Z'), put('g1', -200, '2026-02-05T00:00:00.000Z')];
    expect(foldContributions(events).get('g1')).toBe(300);
  });

  it('drops money earmarked for a goal that no longer exists', () => {
    // Otherwise deleting a goal would leave its money permanently reserved with
    // nothing on screen able to release it.
    const events: LedgerEvent[] = [
      upsert(goal()),
      put('g1', 500, '2026-01-05T00:00:00.000Z'),
      { id: 'r', type: 'goal_remove', timestamp: '2026-03-01T00:00:00.000Z', goalId: 'g1' },
    ];
    expect(foldContributions(events).size).toBe(0);
    expect(totalReserved(events)).toBe(0);
  });

  it('adds up across goals', () => {
    const events = [
      upsert(goal({ id: 'a' })),
      upsert(goal({ id: 'b' })),
      put('a', 100, '2026-01-05T00:00:00.000Z'),
      put('b', 250, '2026-01-05T00:00:00.000Z'),
    ];
    expect(totalReserved(events)).toBe(350);
  });
});

describe('goalProgress', () => {
  it('reports what is saved and what is left', () => {
    const [p] = goalProgress([upsert(goal()), put('g1', 1500, '2026-01-05T00:00:00.000Z')], NOW);
    expect({ saved: p.saved, remaining: p.remaining }).toEqual({ saved: 1500, remaining: 4500 });
    expect(p.ratio).toBeCloseTo(0.25, 5);
  });

  it('is reached, with nothing remaining, once the target is met or passed', () => {
    const [p] = goalProgress([upsert(goal()), put('g1', 7000, '2026-01-05T00:00:00.000Z')], NOW);
    expect(p.state).toBe('reached');
    expect(p.remaining).toBe(0);
    expect(p.ratio).toBeGreaterThan(1);
  });

  it('withholds a pace from one month of history', () => {
    // One contribution is a data point, not a rate.
    const [p] = goalProgress([upsert(goal()), put('g1', 500, '2026-08-01T00:00:00.000Z')], NOW);
    expect(p.monthlyPace).toBeNull();
    expect(p.state).toBe('no-deadline');
  });

  it('averages the pace over the months since the first contribution', () => {
    // Jan through Aug inclusive is 8 months; 1600 saved is 200/month.
    const events = [upsert(goal()), put('g1', 800, '2026-01-05T00:00:00.000Z'), put('g1', 800, '2026-05-05T00:00:00.000Z')];
    const [p] = goalProgress(events, NOW);
    expect(p.monthlyPace).toBe(200);
  });

  it('compares the pace kept with the pace the deadline needs', () => {
    // 4400 left over 4 months needs 1100/month; 200 is nowhere near it.
    const events = [
      upsert(goal({ targetDate: '2026-12-31' })),
      put('g1', 800, '2026-01-05T00:00:00.000Z'),
      put('g1', 800, '2026-05-05T00:00:00.000Z'),
    ];
    const [p] = goalProgress(events, NOW);
    expect(p.requiredMonthly).toBe(1100);
    expect(p.state).toBe('behind');
  });

  it('is on track when the pace clears the requirement', () => {
    const events = [
      upsert(goal({ target: 2000, targetDate: '2026-12-31' })),
      put('g1', 800, '2026-06-05T00:00:00.000Z'),
      put('g1', 800, '2026-07-05T00:00:00.000Z'),
    ];
    const [p] = goalProgress(events, NOW);
    expect(p.state).toBe('ahead');
  });

  it('projects an arrival month from the pace', () => {
    const events = [upsert(goal()), put('g1', 800, '2026-01-05T00:00:00.000Z'), put('g1', 800, '2026-05-05T00:00:00.000Z')];
    const [p] = goalProgress(events, NOW);
    // 4400 left at 200/month is 22 more months: August 2026 + 22 = June 2028.
    expect(p.projectedMonth).toBe('2028-06');
  });

  it('has no projection without a pace, rather than projecting "never"', () => {
    const [p] = goalProgress([upsert(goal())], NOW);
    expect(p.projectedMonth).toBeNull();
    expect(p.monthlyPace).toBeNull();
  });

  it('is behind once the deadline has passed with money still to find', () => {
    const events = [upsert(goal({ targetDate: '2026-03-31' })), put('g1', 100, '2026-01-05T00:00:00.000Z')];
    const [p] = goalProgress(events, NOW);
    expect(p.monthsLeft).toBeLessThan(0);
    expect(p.state).toBe('behind');
  });
});
