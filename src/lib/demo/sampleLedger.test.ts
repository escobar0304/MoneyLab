import { describe, it, expect } from 'vitest';
import { sampleLedger, isDemoLedger, isDemoEvent, DEMO_PREFIX } from './sampleLedger';
import { foldRecurring, foldBudgets, foldPostedMonths, foldCategories, foldSkips } from '../core/entities';
import { occurrencesUpTo } from '../core/recurrence';
import { monthKey } from '../core/derive';
import { foldGoals } from '../planning/goals';
import { foldDebts } from '../planning/debt';
import { foldChallenges } from '../planning/challenges';
import { foldHoldings } from '../core/entities';
import { capitalGainsByYear } from '../investments/capitalGains';

/** Mid-month: the salary (5th) has landed but the late-month expenses (21st,
 * 22nd) have not, so the current month is deliberately half-built. */
const NOW = new Date('2026-09-16T12:00:00.000Z');

describe('the demo prefix', () => {
  // The whole removability story rests on this: if a single event escaped the
  // prefix, clearing the demo would leave it behind forever, in a ledger the
  // reader now believes is their own.
  it('marks every single event it generates', () => {
    const events = sampleLedger(NOW);
    expect(events.length).toBeGreaterThan(50);
    expect(events.every(isDemoEvent)).toBe(true);
  });

  // The other half of the same property, from the real side: ids the app itself
  // mints are UUIDs, which cannot begin with a letter run like `demo-`.
  it('cannot collide with an id the app would mint', () => {
    for (let i = 0; i < 200; i++) {
      expect(crypto.randomUUID().startsWith(DEMO_PREFIX)).toBe(false);
    }
  });

  it('recognises a sample ledger and leaves a real one alone', () => {
    expect(isDemoLedger(sampleLedger(NOW))).toBe(true);
    expect(isDemoLedger([{ id: crypto.randomUUID() }, { id: crypto.randomUUID() }])).toBe(false);
    expect(isDemoLedger([])).toBe(false);
  });
});

describe('sampleLedger', () => {
  it('is the same ledger every time for the same day', () => {
    expect(sampleLedger(NOW)).toEqual(sampleLedger(NOW));
  });

  it('is in chronological order, like the log it imitates', () => {
    const stamps = sampleLedger(NOW).map((e) => e.timestamp);
    expect(stamps).toEqual([...stamps].sort());
  });

  // A ledger that knows about next week reads as broken the moment anyone
  // notices, and the entries list sorts it to the top where they will.
  it('dates nothing in the future', () => {
    for (const event of sampleLedger(NOW)) {
      expect(event.timestamp <= NOW.toISOString()).toBe(true);
    }
  });

  it('holds back a payday that has not come round yet', () => {
    // The 2nd is before payday on the 5th, so this month owes a salary it has
    // not been paid — the generator must not have invented it either.
    const early = sampleLedger(new Date('2026-09-02T12:00:00.000Z'));
    const salaries = early.filter((e) => e.type === 'income' && e.label === 'Salary');
    expect(salaries.some((e) => monthKey(e.timestamp) === '2026-09')).toBe(false);
    expect(salaries.some((e) => monthKey(e.timestamp) === '2026-08')).toBe(true);
  });

  it('has been paid once payday has passed', () => {
    const salaries = sampleLedger(NOW).filter((e) => e.type === 'income' && e.label === 'Salary');
    expect(salaries.some((e) => monthKey(e.timestamp) === '2026-09')).toBe(true);
  });
});

describe('what the sample ledger derives into', () => {
  const events = sampleLedger(NOW);

  it('fills every surface the app opens on', () => {
    expect(foldCategories(events).length).toBeGreaterThanOrEqual(5);
    // One salary in, four fixed bills out.
    expect(foldRecurring(events, 'income')).toHaveLength(1);
    expect(foldRecurring(events, 'expense')).toHaveLength(4);
    expect(foldBudgets(events).size).toBe(4);
    expect(foldGoals(events)).toHaveLength(1);
    expect(foldDebts(events)).toHaveLength(1);
    expect(foldChallenges(events)).toHaveLength(1);
    expect(foldHoldings(events)).toHaveLength(2);
  });

  // Without a recorded price a holding is counted at cost, so the portfolio
  // reads as dead flat for anyone whose browser cannot reach the price proxy —
  // which includes every reader trying the demo on plain static hosting.
  it('carries a recorded price, so the portfolio moves without a network', () => {
    for (const holding of foldHoldings(events)) {
      expect(holding.lastPrice).toBeGreaterThan(holding.avgCost);
    }
  });

  // The demo exists to show the product working; a capital-gains report that
  // opens empty shows the opposite.
  it('has a realised gain in the year the report opens on', () => {
    const year = capitalGainsByYear(events, NOW.getUTCFullYear());
    expect(year.lots.length).toBeGreaterThan(0);
    expect(year.netGain).toBeGreaterThan(0);
  });

  // `runRecurring` fires on mount. If the sample's own entries did not cover
  // every month its rules would generate, loading the demo would immediately
  // double the salary and every fixed bill — which looks exactly like a bug in
  // the generator, on the first screen anybody sees.
  it('leaves the recurring generator with nothing to add', () => {
    const posted = foldPostedMonths(events);
    const skipped = foldSkips(events);
    for (const rule of foldRecurring(events)) {
      for (const date of occurrencesUpTo(rule, NOW)) {
        const key = `${rule.id}:${monthKey(date.toISOString())}`;
        expect(posted.has(key) || skipped.has(key)).toBe(true);
      }
    }
  });
});

describe('the sample ledger through the year', () => {
  // Loading the demo in early January is the case that breaks naive relative
  // dating: "a month ago" is last year, and a sale clamped into this one can
  // land in the future.
  it.each(['2027-01-03T12:00:00.000Z', '2026-12-31T23:00:00.000Z', '2026-02-28T12:00:00.000Z', '2026-03-01T00:30:00.000Z'])(
    'stays coherent when loaded on %s',
    (iso) => {
      const now = new Date(iso);
      const events = sampleLedger(now);

      expect(events.every((e) => e.timestamp <= now.toISOString())).toBe(true);
      expect(events.every(isDemoEvent)).toBe(true);

      const trades = events.filter((e) => e.type === 'trade');
      const buy = trades.find((e) => e.type === 'trade' && e.side === 'buy' && e.holdingId.endsWith('aapl'));
      const sell = trades.find((e) => e.type === 'trade' && e.side === 'sell');
      // FIFO has nothing to match a sale against if it predates its own buy.
      expect(buy && sell && buy.timestamp < sell.timestamp).toBe(true);
    }
  );
});
