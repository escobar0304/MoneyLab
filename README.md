# MoneyLab

A local-only personal finance simulator. Every dollar you log gets allocated into
buckets by rules you define — percentages, fixed amounts, or nested sub-splits —
and everything (income, expenses, subscriptions, net worth) is tracked as a
permanent, append-only ledger stored entirely in your browser.

No accounts, no server, no bank connections. It's a modeling/tracking sandbox with
real persistence over time.

## Features

- **Allocation engine** — split an income event across buckets by percent, fixed
  dollar amount, or "remainder." Rules can be nested (e.g. Investments 30% → Stocks
  60% / Crypto 40% of that 30%). Save a split as a reusable template, or edit it
  one-off per transaction.
- **Expense tracking** — manual entries with free-form category/subcategory, drawn
  down against a bucket's balance. Monthly summary compares spend per category
  against the previous month and shows over/underspend vs. what was allocated.
- **Subscription tracker** — weekly/monthly/yearly billing cycles, trial-end
  tracking, renewal countdowns, and a running committed monthly/annual total.
  Elapsed billing cycles are simulated and charged automatically whenever you open
  the app (not real-time — recalculated on load).
- **Net worth tracker** — manual assets/liabilities plus investment/savings
  buckets, which feed into net worth automatically. Snapshot on demand, see the
  trend over time.
- **History** — the full ledger, filterable by event type.
- **Trends** — net worth over time, spend by category, allocation vs. actual
  variance.
- **Export/import** — the entire ledger as a single JSON file, for backup or
  moving to another device.

## Tech stack

- **Vite + React + TypeScript**
- **Zustand** (with the `persist` middleware) for state, backed by `localStorage`
- **Tailwind CSS v4** for styling
- **Recharts** for charts
- **Vitest** for the allocation/derivation math tests

No backend, no database — everything lives in one browser's `localStorage`.

## Getting started

```bash
npm install
npm run dev      # start the local dev server
npm run test     # run the allocation/derivation test suite
npm run build    # type-check + production build
```

## How it's built

### The ledger is the source of truth

Nothing in this app is stored as mutable state. Every action — logging income,
recording an expense, editing a bucket, renewing a subscription — appends one
`LedgerEvent` to a single `events: LedgerEvent[]` array. Bucket balances, net
worth, monthly spend, and every other number on screen are **computed from that
array on the fly**, never written down directly. That means:

- Nothing can silently drift out of sync with its history — recompute from
  `events` and you get the truth.
- The entire app's data is one JSON array. That's literally what "export" writes
  to disk.
- Auditing is free: the History tab is just the same array, sorted and filtered.

`events` is persisted to `localStorage` (key `moneylab-v1`) via Zustand's
`persist` middleware, so it survives reloads without any extra plumbing.

### Two layers of derivation

Some things — buckets, allocation templates, subscriptions — behave like normal
"current state" even though they're stored as a history of `_upsert` events. A
small folding layer (`src/lib/entities.ts`) walks the ledger and reduces it down
to "the current list of buckets," the same way a Redux reducer replays actions.
Financial numbers — balances, net worth, spend-by-category — go through a
separate derivation layer (`src/lib/derive.ts`) that's pure functions over the
event array, so they're trivially unit-testable and can be evaluated **as of any
point in time** (`asOf`), which is what powers the net worth trend chart.

### Project structure

```
src/
  lib/
    types.ts          All domain types — Bucket, AllocationRule, Subscription, LedgerEvent union
    store.ts           Zustand store: the events array, all mutating actions, persistence
    allocation.ts       The recursive split engine (percent/fixed/remainder + nested sub-rules)
    entities.ts         Folds bucket_upsert/subscription_upsert/etc. events into "current state" lists
    derive.ts           Pure functions: bucket balances, net worth, spend, allocation-vs-actual variance
    subscriptions.ts    Renewal-date math and elapsed-cycle simulation
    chartTheme.ts       The validated color palette used by every chart
    format.ts / id.ts   Small formatting/ID helpers
  components/
    layout/            AppShell + tab navigation
    ui/                 Shared primitives (Card, Button, Modal, Badge, etc.)
    home/               Dashboard: balances, income entry, upcoming renewals, month-vs-allocation
    buckets/            Bucket tree, the recursive AllocationRuleBuilder, template manager
    expenses/           Expense entry + monthly category summary
    subscriptions/      Subscription CRUD + renewal list
    networth/           Net worth entry + trend chart
    history/            Filterable ledger timeline
    trends/             The three Recharts views
    settings/           Export / import / clear-all
```

### The allocation engine

`allocate(amount, rules)` in `src/lib/allocation.ts` is the heart of the app. Each
rule is `percent`, `fixed`, or `remainder`. Percent/fixed rules are computed
first; whatever's left (which can be negative, if you've over-allocated) is split
across any `remainder` rules, or falls into the built-in **Unallocated** bucket if
there isn't one. Any rule can carry `subRules`, which recursively re-splits that
rule's own share instead of crediting its own bucket — that's how "Investments
30% → Stocks 60% / Crypto 40%" works. It's covered by unit tests in
`allocation.test.ts` for exactly these cases (plain percent splits, fixed +
remainder, over-allocation, nesting, and merging repeated bucket references).

### Subscriptions "simulate" renewals

Subscriptions don't run on a timer. Every time the app loads,
`runSubscriptionSimulation()` walks each active subscription, works out how many
billing cycles have elapsed since it was last charged (`elapsedChargeDates` in
`subscriptions.ts`), and appends one `subscription_charge` event per elapsed
cycle — so if you don't open the app for two months, you'll see two catch-up
charges land in the ledger with their original historical dates, deducted from
the linked bucket.

## Is it "optimized to the max"?

No — it's optimized for correctness and clarity of the money math, not for raw
bundle size or runtime performance, and honestly it doesn't need to be:

- The production JS bundle is ~632 KB (~184 KB gzipped) as a single chunk — no
  route-level code splitting. Recharts is almost certainly the majority of that
  weight, and it's only used on 2 of the 8 tabs (Net Worth, Trends). Lazy-loading
  those two views would be the one change with a real payoff if this mattered.
- Derived values (`bucketBalances`, `netWorthSeries`, etc.) do an O(n) scan over
  the full ledger, memoized per component with `useMemo` keyed on the `events`
  array — so a mutation only triggers one recompute per view, not per render. For
  a personal ledger (hundreds to low thousands of entries over years) this is
  effectively instant; it would only start to matter at a scale this app isn't
  meant for.
- No virtualization on the History list, no `React.memo` anywhere — the component
  tree is small enough that it doesn't matter.

Given this runs once, locally, for one user, on data that grows slowly, I'd call
the current tradeoff correct rather than under-optimized. Say the word if you
want the Recharts lazy-load done anyway.
