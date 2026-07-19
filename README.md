# MoneyLab

A local-only personal money tracker: set your monthly salary, log expenses as they
happen, and see two real charts of what's going on. Everything is stored as a
permanent, append-only ledger entirely in your browser.

No accounts, no server, no bank connections. Deliberately minimal — this isn't a
full budgeting suite, it's "salary and expenses, that's it."

## Features

- **Monthly salary** — set an amount once; it auto-pays itself into your balance
  every month, even if you don't open the app for a while (elapsed months are
  caught up on load, with their real historical dates).
- **Extra income** — a quick one-off entry for anything that isn't your salary (a
  bonus, a gift, a side gig payment).
- **Expense tracking** — amount, date, a free-text category (with autocomplete
  from what you've already typed), optional subcategory and note. A monthly
  summary compares this month's spend per category against last month's.
- **Balance** — the one headline number: everything you've earned minus everything
  you've spent, computed live from the ledger, never entered by hand.
- **Two charts on Home** — income vs. expenses over time, and spend by category —
  both real Recharts charts, not sparklines.
- **Export/import** — the entire ledger as a single JSON file, for backup or
  moving to another device.

## Tech stack

- **Vite + React + TypeScript**
- **Zustand** (with the `persist` middleware) for state, backed by `localStorage`
- **Tailwind CSS v4** for styling, dark-mode only
- **Recharts** for the two Home charts
- **Vitest** for the ledger-derivation math tests

No backend, no database — everything lives in one browser's `localStorage`.

### Dark mode, one theme only

There's no light/dark toggle — dark is simply the app's one look, chosen for lower
eye strain over long sessions. Page background, card surface, and borders sit on
three distinct lightness steps (`neutral-950` / `neutral-900` / `neutral-800`) so
sections read as physically separate panels, and body text uses a soft off-white
(`neutral-100`) rather than pure white. A single `accent` blue (defined once in
`src/index.css` via Tailwind v4's `@theme`, reused as the chart palette's primary
hue in `src/lib/chartTheme.ts`) is the one color that means "interactive." The
chart palette is the `dataviz` skill's validated dark-mode set.

## Getting started

```bash
npm install
npm run dev      # start the local dev server
npm run test     # run the ledger-derivation test suite
npm run build    # type-check + production build
```

## How it's built

### The ledger is the source of truth

Nothing in this app is stored as mutable state. Every action — setting your
salary, logging income, recording an expense — appends one `LedgerEvent` to a
single `events: LedgerEvent[]` array. Your balance and every chart are **computed
from that array on the fly**, never written down directly:

- Nothing can silently drift out of sync with its history — recompute from
  `events` and you get the truth.
- The entire app's data is one JSON array. That's literally what "export" writes
  to disk.

`events` is persisted to `localStorage` (key `moneylab-v1`) via Zustand's
`persist` middleware, so it survives reloads without any extra plumbing.

### Project structure

```
src/
  lib/
    types.ts        Domain types — Salary, LedgerEvent union (income/expense/salary_upsert)
    store.ts         Zustand store: the events array, actions, persistence
    entities.ts       Folds salary_upsert (+ matching income events) into current salary state
    derive.ts         Pure functions: balance, balance-over-time, spend by category, monthly totals
    recurrence.ts      Monthly-cycle date math + elapsed-cycle simulation (powers salary auto-pay)
    chartTheme.ts      The validated dark-mode color palette used by the two charts
    format.ts / id.ts  Small formatting/ID helpers
  components/
    layout/           AppShell + tab navigation
    ui/                Shared primitives (Card, Button, Modal, Badge, etc.)
    home/              Balance, salary form, extra income, the two charts
    expenses/          Expense entry + monthly category summary
    settings/          Export / import / clear-all
```

Three tabs: **Home**, **Expenses**, **Settings**. That's the whole app.

### Salary "simulates" monthly pay

Salary doesn't run on a timer. Every time the app loads, `runSalarySimulation()`
works out how many monthly cycles have elapsed since your salary was last paid
(`elapsedChargeDates` in `recurrence.ts`) and appends one `income` event per
elapsed cycle — so if you don't open the app for two months, you'll see two
catch-up payments land in the ledger with their original historical dates.

## Is it "optimized to the max"?

No, but at this scope it doesn't need to be:

- No lazy-loading or code-splitting — Home (the default tab) is the only place
  Recharts is used, so there's no other tab whose load time it could protect.
  Single JS chunk, ~595 KB (~175 KB gzipped).
- `derive.ts` does an O(n) scan over the full ledger, memoized per component with
  `useMemo` keyed on the `events` array — a mutation triggers one recompute per
  view, not per render. For a personal ledger (hundreds to low thousands of
  entries over years) this is effectively instant.

Given this runs once, locally, for one user, on data that grows slowly, that's a
reasonable tradeoff, not a shortfall.
