# MoneyLab

A local-only personal finance tracker. Log income and expenses as they happen and
everything else — budgets, recurring bills, savings goals, debt payoff, a stock
and crypto portfolio, IRS (Portuguese tax) deductions — is derived from that one
ledger. Everything is stored as a permanent, append-only event log entirely in
your browser.

No accounts, no server, no bank connections.

## Features

**Income & expenses** — the Entries tab, split into **Log** and **Manage**
(a `Segmented` control switches between them, History stays visible either
way) so logging a coffee and merging two mistyped categories aren't presented
as the same kind of task — one happens daily, the other happens once in a
while to keep Log honest.

*Log — what posts an entry:*
- One-off income and expenses: amount, date, a free-text category (with
  autocomplete), optional subcategory, note, and multiple pots (accounts) to
  post against.
- **Recurring rules** for anything monthly — salary, rent, a subscription —
  income and expense alike. Elapsed cycles are caught up on load with their real
  historical dates, and any single month can be skipped without deleting the rule.
- **Multi-currency entries**: log in another currency and it's converted to the
  base currency (EUR) via ECB reference rates, with the original amount and rate
  kept alongside for the audit trail.

*Manage — the setup that keeps Log honest:*
- **Bank statement import** (CSV/OFX) previewed before anything is written,
  plus **rules** that auto-categorize matching entries by text, amount, or
  category — one primitive that drives both import auto-filing and manual
  tidy-up.
- **Accounts** — divide the balance into pots (main, savings, investment,
  other) and transfer between them; the sum is always the one true balance.
- **Budgets** — a monthly spending limit per category, shown as a meter against
  this month's spend.
- **Subscriptions** — detected from repeating charges in your own history, with
  a price-rise called out and a one-click way to turn one into a recurring rule.
- **Categories** — rename or merge (accent/case-folded, so "Saúde" and "saude"
  are caught), updating every entry, rule and budget at once.

Always available regardless of section: marking an entry as reconciled against
the bank, without touching the record of what actually happened — that lives
in History, which stays on screen through both Log and Manage.

**Planning**
- **Goals** — earmark part of the balance toward a target, with a deadline and
  a required-pace-vs-actual-pace read on whether you're on track.
- **Debt** — a loan's amortization schedule from principal/rate/term, plus a
  "what if I overpaid" projection of months and interest saved.
- **IRS deductions** — map your categories to Portuguese IRS deduction
  headings and track spend against each heading's annual ceiling, with an
  editable ceiling since the published rates move every state budget.

**Portfolio** — what you own
- Holdings (shares, funds, crypto) with buy/sell trades and dividends, cost
  basis and return computed from the trade log rather than a single average.
- **Live prices**, polled periodically and merged into net worth and the
  portfolio view; paused when the tab isn't visible.

**Markets** — what's out there, on its own tab from Portfolio since owning
something and watching it change on different rhythms
- A **TradingView chart embed** and a symbol watchlist for anything you're
  tracking, priced or not.
- For the selected symbol: a **technical rating** (TradingView's own buy/sell/
  neutral read across its indicators), a **symbol info** strip, and recent
  **news**.
- **Explore markets** — a market overview (indices, crypto, forex) and a
  **trending** list (today's top gainers/losers/most active), both independent
  of your watchlist, for browsing before you know what you're looking for.
- Every TradingView embed on this tab mounts only once it scrolls near the
  viewport (an `IntersectionObserver`, not a timer) — with five or six of them
  on one page, loading them all at once starves the browser's per-host
  connection limit and the lower ones simply never finish.

**Dashboard & insight**
- Net worth (or balance, until there's a portfolio or debt to compose it from)
  as the one headline figure, with a 60-day cash runway underneath it.
- Trends: net worth and income-vs-expenses over time, savings rate, spend by
  category over time.
- A month-scoped snapshot: budget meter, saved/spent this month with deltas
  against last month and the same month last year, a month-end forecast, where
  the money went, what changed since last month, and outsized charges worth a
  look.
- **Drill-down** — click any chart mark to see the underlying entries.
- **Time travel** — view the whole dashboard as it stood on a past date; free,
  because the ledger is append-only and that view is just a filter over it.

**Data & privacy**
- **Privacy mode** — blur every figure instantly, for when the screen turns
  around.
- **Compact/comfortable density** — one panel-padding variable, swapped app-wide.
- **Export/import** the entire ledger as JSON, and **encrypted backups**
  (AES-GCM, a passphrase-stretched key) for anywhere less trusted than your own
  disk.
- **Silent folder backups** via the File System Access API — pick a folder once,
  it's kept in sync with no further prompts (Chromium-based browsers only).
- Optional **receipt photos**, stored in IndexedDB and exported separately so a
  routine JSON export stays small.
- **Keyboard shortcuts** (`g` then a letter to jump to a tab, `n` for a new
  expense, `Ctrl`/`⌘Z` to undo, `?` for the full list).

## Tech stack

- **Vite + React 19 + TypeScript**
- **Zustand** (with the `persist` middleware) for state, backed by `localStorage`
- **Tailwind CSS v4** for styling, dark-mode only
- **Recharts** for charts, **GSAP** for motion
- **Vitest** + **Testing Library** for unit tests, **Playwright** for e2e
- **vite-plugin-pwa** for installability/offline

No backend, no database — everything lives in one browser's `localStorage`
(plus IndexedDB for receipts and the backup folder handle).

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
npm run test     # run the unit/derivation test suite
npm run test:e2e # run the Playwright end-to-end suite
npm run build    # type-check + production build
```

## How it's built

### The ledger is the source of truth

Nothing in this app is stored as mutable state. Every action — logging an
expense, filing a category under an IRS heading, buying a holding, moving money
between accounts — appends one `LedgerEvent` to a single `events: LedgerEvent[]`
array (`src/lib/types.ts`). Every figure and chart is **computed from that array
on the fly**, never written down directly:

- Nothing can silently drift out of sync with its history — recompute from
  `events` and you get the truth.
- The entire app's data is one JSON array. That's literally what "export" writes
  to disk.
- "As of a past date" (time travel) is just filtering that same array — no
  second history to keep, and no replay needed.

`events` is persisted to `localStorage` via Zustand's `persist` middleware, and
brought up to the current shape on load by `src/lib/migrations.ts` — old event
shapes (a v0 `salary_upsert`, a v1 `recurring_income_upsert`) migrate forward
losslessly rather than being read-time-tolerated all over the codebase.

### Project structure

```
src/
  lib/
    types.ts, store.ts        Domain types + the Zustand store (events, actions, persistence)
    entities.ts, accounts.ts   Fold functions: current categories/budgets/accounts from the log
    derive.ts, analysis.ts     Pure functions: balance, totals, forecasts, deltas
    investments.ts, quotes.ts  Portfolio pricing; useLiveQuotes.ts polls and caches live prices
    goals.ts, debt.ts, irs.ts  Domain math for each planning feature
    rules.ts, statements.ts    Auto-categorization + bank statement CSV parsing
    recurrence.ts               Monthly-cycle date math + elapsed-cycle simulation
    migrations.ts                Brings old ledger shapes up to the current one
    backup.ts, crypto.ts,       Silent folder auto-backup + AES-GCM encrypted exports
    receipts.ts                  Receipt photo storage (IndexedDB)
    chartTheme.ts, chartTables.ts, format.ts, currency.ts, drill.ts, search.ts, …
  components/
    layout/     AppShell + Sidebar (tab navigation, icons)
    ui/          Shared primitives (Card, Button, Modal, ChartCard, Segmented, StatTile, …)
    overview/    The dashboard: hero net worth, trend charts, the monthly snapshot
    entries/     Every input, split into Log (EntriesView's default) and Manage
                  via a Segmented control — recurring, expense form on Log;
                  accounts, budgets, rules, statement import, categories on Manage
    plan/        Goals and debt
    irs/         IRS deduction tracking, its own tab
    portfolio/   Holdings, trades, dividends — what you own
    markets/     Watchlist, TradingView chart + technical/news/overview widgets
    settings/    Export/import, backup folder, appearance
```

Seven tabs: **Overview**, **Entries**, **Plan**, **IRS**, **Portfolio**,
**Markets**, **Settings**. Portfolio and Markets used to be one "Markets" tab;
they split because owning ten shares of something and watching a symbol you
don't hold are different questions with different rhythms — one changes when
you trade, the other when you're just looking around. `SymbolPicker`
(`components/ui/`) is shared between them since both need to look up the same
instruments. Overview ships eagerly since it's the landing tab; every other tab
is a separate lazy chunk, so a session that never opens Markets never downloads
the TradingView embeds.

### Recurring events "simulate" monthly cycles

A recurring rule doesn't run on a timer. Every time the app loads,
`runRecurring()` works out how many monthly cycles have elapsed since a rule was
last charged (`elapsedChargeDates` in `recurrence.ts`) and appends one event per
elapsed cycle — so if you don't open the app for two months, you'll see two
catch-up entries land with their original historical dates. All the date math is
done in UTC and anchored to the original start date rather than stepped
month-by-month, which is what keeps a 31st-of-the-month rule from sliding to the
28th after one short month.

---

*This file should be kept in step with the app. Update it whenever a change adds,
removes, or meaningfully reshapes a feature or the project structure — not on
every commit, but whenever a reader relying on this file would otherwise be
misled.*
