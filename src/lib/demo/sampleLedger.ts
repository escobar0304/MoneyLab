import type { LedgerEvent } from '../core/types';

/**
 * A ledger to look at before you have one of your own.
 *
 * Every figure in this app is derived from the event log, which is a good
 * property with one cost: an empty log makes an empty product. Nothing can be
 * judged — not a chart, not the runway, not whether the IRS headings are worth
 * the trouble — without first typing in a few months of someone's life. This
 * generates those months.
 *
 * Two rules hold everything else together:
 *
 * 1. **Every id starts with `demo-`.** Real ids come from `makeId`, which is
 *    `crypto.randomUUID()` — a UUID cannot begin with a letter sequence like
 *    that, so the two sets are provably disjoint. That is what lets demo data
 *    be taken back out again later without a flag, a second store, or any risk
 *    of catching a real entry in the sweep.
 * 2. **Nothing here is random.** The same `now` produces the same ledger, byte
 *    for byte, so a test can assert on it and two people looking at the demo
 *    are looking at the same thing.
 */

/** The marker that makes demo data removable. See rule 1 above. */
export const DEMO_PREFIX = 'demo-';

export function isDemoEvent(event: { id: string }): boolean {
  return event.id.startsWith(DEMO_PREFIX);
}

/**
 * Whether the ledger on screen is the sample one.
 *
 * Derived rather than stored, like everything else here: a flag in the store
 * could drift out of step with the events it describes, and this cannot.
 */
export function isDemoLedger(events: { id: string }[]): boolean {
  return events.some(isDemoEvent);
}

/** How many whole months of history the sample covers, ending at `now`. */
const MONTHS = 6;

/**
 * How far back the portfolio goes — deliberately much further than the ledger.
 *
 * Two reasons, and the second is the one that matters. Somebody who starts
 * logging expenses today usually already owned something, so a portfolio older
 * than the ledger is the realistic case. And annualising a gain over a few
 * months produces absurd figures: the same 21% that reads as a good year over
 * eighteen months reads as 59% a year over five, which is not a number a
 * personal-finance demo should be waving around.
 */
const PORTFOLIO_MONTHS = 18;

/**
 * An ISO timestamp `monthsBack` months before `now`, on `day`.
 *
 * Built in UTC because the recurrence engine anchors on `getUTCDate`, and a
 * local-time date here would drift a day either side of it depending on where
 * the reader is. The day is clamped to the month's length so a 31st never
 * silently rolls into the next month.
 */
function at(now: Date, monthsBack: number, day: number, hour = 9): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - monthsBack;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), hour, 0, 0, 0)).toISOString();
}

/** The salary rule every month's income event is generated against.
 *
 * Paid early in the month, which is both common here and the kinder default
 * for a demo: a payday late in the month means that for most of it the current
 * month reads as a heavy loss, and the dashboard is the first thing anyone
 * sees. The 5th is after rent on the 1st, so the sequencing still looks real. */
const SALARY_ID = `${DEMO_PREFIX}recurring-salary`;
const SALARY_DAY = 5;
const SALARY = 2400;

/**
 * The shape of a month's spending, repeated with a little drift.
 *
 * Fixed days rather than scattered ones because the point is to look like
 * somebody's actual month — rent at the start, a shop most weeks, one dinner
 * out — not to look shuffled.
 */
const MONTHLY: ReadonlyArray<{ category: string; note: string; day: number; amount: number; committed?: true }> = [
  { category: 'Rent', note: 'Flat', day: 1, amount: 780, committed: true },
  { category: 'Transport', note: 'Monthly pass', day: 3, amount: 40, committed: true },
  { category: 'Groceries', note: 'Weekly shop', day: 6, amount: 96.4 },
  { category: 'Utilities', note: 'Electricity and water', day: 8, amount: 84.15, committed: true },
  { category: 'Subscriptions', note: 'Streaming and music', day: 12, amount: 21.9, committed: true },
  { category: 'Groceries', note: 'Weekly shop', day: 14, amount: 88.2 },
  { category: 'Eating out', note: 'Dinner out', day: 17, amount: 38.5 },
  { category: 'Groceries', note: 'Weekly shop', day: 21, amount: 104.75 },
  { category: 'Health', note: 'Pharmacy', day: 22, amount: 26.3 },
];

/** The id of the recurring rule a committed line is generated against. */
function ruleIdFor(item: { category: string; day: number }): string {
  return `${DEMO_PREFIX}recurring-${slug(item.category)}-${item.day}`;
}

/**
 * Per-month multipliers, so the charts have a shape instead of a flat line.
 *
 * Indexed by how many months back, and deliberately hand-picked rather than
 * generated: an even sawtooth reads as fake, and a random walk would break the
 * determinism the tests rely on. Only the variable lines drift — a rent or a
 * travel pass that wobbles by 7% a month is the detail that gives a fake ledger
 * away, and those are exactly the lines a recurring rule declares a fixed
 * amount for.
 */
const DRIFT = [1.03, 0.94, 1.12, 0.98, 1.07, 0.96, 1] as const;

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Category names go into ids, and one of them has a space in it. */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * The sample ledger, ending today.
 *
 * `now` is a parameter so tests can pin it; nothing else should pass it.
 */
export function sampleLedger(now: Date = new Date()): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  const currentYear = now.getUTCFullYear();

  // ---- Income -------------------------------------------------------------
  // The rule comes first so the entries below can point at it. Its start date
  // is the oldest payday in the sample, which is what makes the generator in
  // `runRecurring` agree that every month since is already posted.
  events.push({
    id: SALARY_ID,
    type: 'recurring_upsert',
    timestamp: at(now, MONTHS, SALARY_DAY),
    rule: {
      id: SALARY_ID,
      kind: 'income',
      label: 'Salary',
      amount: SALARY,
      cycle: 'monthly',
      startDate: at(now, MONTHS, SALARY_DAY),
      active: true,
    },
  });

  for (let back = MONTHS; back >= 0; back--) {
    const timestamp = at(now, back, SALARY_DAY);
    // A payday later this month has not happened yet. Posting it would both
    // overstate the year and disagree with what `runRecurring` would generate,
    // which is the one thing that could make the demo look buggy.
    if (timestamp > now.toISOString()) continue;
    events.push({
      id: `${DEMO_PREFIX}income-salary-${back}`,
      type: 'income',
      timestamp,
      amount: SALARY,
      label: 'Salary',
      recurringId: SALARY_ID,
    });
  }

  // One irregular payment, so income is not a single flat repeating line.
  events.push({
    id: `${DEMO_PREFIX}income-freelance`,
    type: 'income',
    timestamp: at(now, 3, 14),
    amount: 640,
    label: 'Freelance invoice',
  });

  // ---- Committed outgoings ------------------------------------------------
  // The fixed monthly bills are declared as rules, not just as entries, so the
  // recurring panels have something to show and "committed each month" is a
  // real figure. Each generated entry below carries its rule's id, which is
  // what stops `runRecurring` posting a second copy of every one of them.
  for (const item of MONTHLY) {
    if (!item.committed) continue;
    events.push({
      id: `${DEMO_PREFIX}recurring-upsert-${slug(item.category)}-${item.day}`,
      type: 'recurring_upsert',
      timestamp: at(now, MONTHS, item.day),
      rule: {
        id: ruleIdFor(item),
        kind: 'expense',
        label: item.note,
        amount: item.amount,
        category: item.category,
        cycle: 'monthly',
        startDate: at(now, MONTHS, item.day),
        active: true,
      },
    });
  }

  // ---- Expenses -----------------------------------------------------------
  for (let back = MONTHS; back >= 0; back--) {
    const drift = DRIFT[back % DRIFT.length];
    for (const item of MONTHLY) {
      const timestamp = at(now, back, item.day);
      if (timestamp > now.toISOString()) continue;
      events.push({
        id: `${DEMO_PREFIX}expense-${back}-${slug(item.category)}-${item.day}`,
        type: 'expense',
        timestamp,
        // A committed line is the amount its rule declares; only the variable
        // ones drift, or the entries would contradict the rule beside them.
        amount: money(item.committed ? item.amount : item.amount * drift),
        category: item.category,
        note: item.note,
        ...(item.committed ? { recurringId: ruleIdFor(item) } : {}),
      });
    }
  }

  // ---- Budgets ------------------------------------------------------------
  // Set below what the months above actually spend on Eating out, so the demo
  // shows a budget being overrun as well as ones being kept — a budget screen
  // where everything is green demonstrates nothing.
  const budgets: ReadonlyArray<[string, number]> = [
    ['Groceries', 320],
    ['Eating out', 30],
    ['Transport', 60],
    ['Utilities', 95],
  ];
  for (const [category, amount] of budgets) {
    events.push({
      id: `${DEMO_PREFIX}budget-${slug(category)}`,
      type: 'budget_set',
      timestamp: at(now, MONTHS, 2),
      category,
      amount,
    });
  }

  // ---- IRS deductions -----------------------------------------------------
  // Filing the categories under real headings, because an IRS page showing
  // 0,00 € against every heading demonstrates nothing — and this is the part of
  // the app that does something no generic tracker does.
  //
  // Two categories are deliberately left unfiled: a demo where everything is
  // already sorted hides the fact that filing is a decision the reader makes.
  const deductions: ReadonlyArray<[string, string]> = [
    ['Health', 'saude'],
    ['Rent', 'habitacao'],
    ['Groceries', 'geral'],
    ['Utilities', 'geral'],
    // Restaurants are the textbook case for the VAT-on-invoices heading.
    ['Eating out', 'fatura'],
  ];
  for (const [category, ruleId] of deductions) {
    events.push({
      id: `${DEMO_PREFIX}deduction-${slug(category)}`,
      type: 'deduction_map',
      timestamp: at(now, MONTHS, 2),
      category,
      ruleId,
    });
  }

  // ---- Goal ---------------------------------------------------------------
  const goalId = `${DEMO_PREFIX}goal-emergency`;
  events.push({
    id: `${DEMO_PREFIX}goal-upsert`,
    type: 'goal_upsert',
    timestamp: at(now, MONTHS, 2),
    goal: {
      id: goalId,
      label: 'Emergency fund',
      target: 6000,
      targetDate: at(now, -12, 1).slice(0, 10),
      note: 'Three months of outgoings, kept liquid.',
    },
  });
  for (let back = MONTHS - 1; back >= 1; back--) {
    events.push({
      id: `${DEMO_PREFIX}goal-contribution-${back}`,
      type: 'goal_contribution',
      timestamp: at(now, back, 26),
      goalId,
      amount: 250,
    });
  }

  // ---- Debt ---------------------------------------------------------------
  events.push({
    id: `${DEMO_PREFIX}debt-car`,
    type: 'debt_upsert',
    timestamp: at(now, MONTHS, 2),
    debt: {
      id: `${DEMO_PREFIX}debt-car-id`,
      label: 'Car loan',
      principal: 9000,
      annualRate: 4.9,
      termMonths: 48,
      startDate: at(now, 14, 10).slice(0, 10),
      active: true,
    },
  });

  // ---- Challenge ----------------------------------------------------------
  // Dated to be running right now, not finished: a challenge in the past shows
  // a result, and a challenge in progress shows the thing the feature is for.
  events.push({
    id: `${DEMO_PREFIX}challenge-eating-out`,
    type: 'challenge_upsert',
    timestamp: at(now, 1, 1),
    challenge: {
      id: `${DEMO_PREFIX}challenge-eating-out-id`,
      label: 'No eating out',
      categories: ['Eating out'],
      startDate: at(now, 0, 1).slice(0, 10),
      endDate: at(now, -1, 1).slice(0, 10),
    },
  });

  // ---- Portfolio ----------------------------------------------------------
  const world = `${DEMO_PREFIX}holding-vwce`;
  const apple = `${DEMO_PREFIX}holding-aapl`;
  const sellDate = clampIso(at(now, 1, 12), `${currentYear}-01-20T09:00:00.000Z`, now.toISOString());

  events.push(
    {
      id: `${DEMO_PREFIX}holding-vwce-upsert`,
      type: 'holding_upsert',
      timestamp: at(now, PORTFOLIO_MONTHS, 5),
      // A recorded price, so the portfolio shows a real gain with no network
      // at all. A live quote overrides it when the proxy is reachable, which
      // is exactly the precedence `positionsFrom` already implements.
      holding: {
        id: world,
        symbol: 'VWCE',
        label: 'Vanguard FTSE All-World',
        quantity: 20,
        avgCost: 115.09,
        lastPrice: 124.8,
        lastPriceAt: at(now, 0, 1),
      },
    },
    {
      id: `${DEMO_PREFIX}holding-aapl-upsert`,
      type: 'holding_upsert',
      timestamp: at(now, PORTFOLIO_MONTHS, 5),
      holding: {
        id: apple,
        symbol: 'AAPL',
        label: 'Apple',
        quantity: 6,
        avgCost: 182.5,
        lastPrice: 221.5,
        lastPriceAt: at(now, 0, 1),
      },
    },
    {
      id: `${DEMO_PREFIX}trade-vwce-1`,
      type: 'trade',
      timestamp: at(now, PORTFOLIO_MONTHS, 5),
      holdingId: world,
      side: 'buy',
      quantity: 12,
      price: 112.4,
      fees: 1.5,
    },
    {
      id: `${DEMO_PREFIX}trade-vwce-2`,
      type: 'trade',
      timestamp: at(now, 7, 5),
      holdingId: world,
      side: 'buy',
      quantity: 8,
      price: 118.75,
      fees: 1.5,
    },
    {
      id: `${DEMO_PREFIX}trade-aapl-buy`,
      type: 'trade',
      timestamp: at(now, PORTFOLIO_MONTHS, 9),
      holdingId: apple,
      side: 'buy',
      quantity: 10,
      price: 182.3,
      fees: 2,
    },
    {
      id: `${DEMO_PREFIX}trade-aapl-sell`,
      type: 'trade',
      // Pulled forward into the current year when a month back would land in
      // the last one, so the capital-gains report has something in the year it
      // opens on, whatever day the demo is loaded. Capped at today, or loading
      // it in early January would date a sale in the future. The buy above is
      // well over a year older, so FIFO order holds either way.
      timestamp: sellDate,
      holdingId: apple,
      side: 'sell',
      quantity: 4,
      price: 214.6,
      fees: 2,
    },
    {
      id: `${DEMO_PREFIX}dividend-aapl`,
      type: 'dividend',
      timestamp: at(now, 2, 15),
      holdingId: apple,
      amount: 14.2,
    }
  );

  // The log is append-only, so it is kept in the order things happened rather
  // than the order this function happens to build them in.
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** `value` lifted to at least `floor`, then held to at most `ceiling`. The
 * ceiling wins, because a date in the future is a worse lie than an early one. */
function clampIso(value: string, floor: string, ceiling: string): string {
  const lifted = value >= floor ? value : floor;
  return lifted <= ceiling ? lifted : ceiling;
}
