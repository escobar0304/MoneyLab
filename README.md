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
- **Split a purchase into installments** — post one expense over N months
  instead of a single lump sum, with an optional annual interest rate. Reuses
  the same amortization math as the Debt tab, so an interest-free split
  divides evenly (last month absorbs the rounding) and a financed one is the
  real fixed monthly payment a lender would quote. Each posted entry carries
  its place in the group ("3 of 12") in the list and detail view.

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
- **No-spend challenges** — a self-imposed window ("no takeaway for 30
  days") over categories you pick by hand. Purely a tracker, never an
  enforcement: nothing stops an expense from posting in a challenged
  category, it only reports afterwards which days in the window stayed
  clean — a blocked expense would just get logged a day late or under a
  different category, which teaches nothing; a visible day-by-day pattern
  does.
- **IRS deductions** — map your categories to Portuguese IRS deduction
  headings and track spend against each heading's annual ceiling, with an
  editable ceiling since the published rates move every state budget. Purely
  informative: your accountant already has every invoice through e-fatura, so
  this is for knowing where a ceiling stands *before* the return is filed, not
  for handing anything over.

**Taxes** — dates that happen on a fixed day whether you look or not, kept
apart from Plan and IRS for that reason
- **Fiscal calendar** — the IRS (Modelo 3) filing deadline and every
  vehicle's IUC payment(s), merged into one sorted list with days-until.
- **Vehicles**, tracked only for their IUC due date. The amount is typed in
  from your own notice rather than computed: the real formula depends on
  cylinder capacity, CO2 and a table that moves every state budget, and a
  tax *liability* is the one place in this app where a plausible-looking
  wrong number is worse than no number at all. What the app does reliably is
  the date arithmetic. **Installments** are optional and off by default (one
  payment, the full amount, in the registration month) — there for the
  announced rule that splits IUC into more than one payment depending on how
  much is owed, once that actually applies. Logging the actual payment as an
  expense and **tagging it to the vehicle** (an optional field on the expense
  form, shown once a vehicle exists) settles that cycle: the due date drops
  off the calendar instead of sitting there already paid, and reappears on
  its own once the next cycle's date arrives. The real record stays exactly
  where every other expense lives — in History — this only stops the
  calendar from nagging about something already done.

**Portfolio** — what you own
- Holdings (shares, funds, crypto) with buy/sell trades and dividends, cost
  basis and return computed from the trade log rather than a single average.
- **Live prices**, polled periodically and merged into net worth and the
  portfolio view; paused when the tab isn't visible.
- **Capital gains**, year by year, matched FIFO (oldest lot sold first) —
  a second, independent pass over the trade log from the average-cost figures
  shown against each position, because "was this lot held over a year"
  is a question average cost has already blended away. **Export for
  accountant** turns a year into a CSV: every closed lot (symbol, quantity,
  acquired, disposed, days held, gain/loss) plus the totals. Portuguese
  securities are taxed at a flat rate regardless of holding period; crypto
  held over 365 days is currently exempt — this file has no reliable way to
  tell a stock from a crypto-asset by its symbol, so "days held" is left for
  the reader to apply that split by hand.

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
- **Subscription alerts** — an undeclared or repriced repeating charge gets a
  card of its own on the dashboard (nothing shows when there's nothing to
  flag), with a one-click jump straight to Entries → Manage → Subscriptions.
- **What's different this month** — purely informative, no action attached:
  a category with no expense before this month, and a category that had
  spend every month for a while and has gone quiet. Neither is judged good or
  bad — a cancelled subscription and a forgotten one look identical here, and
  a first-time category has no "usual" size to compare against. The quiet
  check only speaks once enough of the month has passed to tell "not yet"
  from "not this time" apart.
- **Coming up** — the next scheduled recurring charges and income, with their
  due dates, for the next 30 days. Reuses the same projection the 60-day
  runway is built from, so the list and the balance line can never disagree.
- **Year & month in review** — a recap on request: saved, savings rate, where
  it went, net worth change, the biggest single surprise, and — for a year —
  the best and toughest months. A year costs nothing extra to compute; it's
  the same per-month figures summed, which is also why Time Travel works.
  **Replay** turns the same numbers into a watched-not-read animation: the
  balance ticks forward one day (or one month, for a year) at a time instead
  of landing on the total straight away.
- **Worth it?** — a week after logging a big enough expense (a threshold you
  set, in Appearance), the Overview asks whether it was worth it. Never for a
  recurring bill or a later instalment of a split purchase — those aren't a
  decision to reflect on. The verdicts roll up into Year & month in review
  ("6 of 8 big purchases were"), the one number here that isn't a metric.
- **What if?** — try a raise, a new bill, or cancelling a subscription against
  the real ledger without logging anything: add a hypothetical change and see
  its effect on next month and on the projected balance for the next 180
  days, next to the real projection for comparison. Nothing is written to the
  store; it's the same `projectRunway()` the 60-day runway card uses, run a
  second time on a throwaway copy of `events` with a few synthetic events
  appended — the same trick Time Travel uses, pointed at a future the ledger
  doesn't contain yet instead of a past date it does.

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
hue in `src/lib/insight/chartTheme.ts`) is the one color that means "interactive." The
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
array (`src/lib/core/types.ts`). Every figure and chart is **computed from that array
on the fly**, never written down directly:

- Nothing can silently drift out of sync with its history — recompute from
  `events` and you get the truth.
- The entire app's data is one JSON array. That's literally what "export" writes
  to disk.
- "As of a past date" (time travel) is just filtering that same array — no
  second history to keep, and no replay needed.

`events` is persisted to `localStorage` via Zustand's `persist` middleware, and
brought up to the current shape on load by `src/lib/core/migrations.ts` — old event
shapes (a v0 `salary_upsert`, a v1 `recurring_income_upsert`) migrate forward
losslessly rather than being read-time-tolerated all over the codebase.

### Project structure

`src/lib/` and `src/components/overview/` are grouped into topical
subfolders rather than left flat — both had grown past the point where a
flat listing was actually faster to scan than a folder tree.

```
src/
  lib/
    core/         types.ts, store.ts (events, actions, persistence), entities.ts
                    (fold functions: current categories/budgets/accounts from
                    the log), derive.ts (balance, totals), migrations.ts,
                    recurrence.ts, search.ts, shortcuts.ts, navigate.ts (a lazy
                    tab asking another lazy tab to switch to it — see below),
                    format.ts, currency.ts, id.ts, animation.ts
    money/        accounts.ts, rules.ts (auto-categorization), statements.ts
                    (bank CSV parsing), subscriptions.ts (repeating-charge
                    detection), splitPayment.ts (instalments with optional
                    interest), receipts.ts
    planning/     goals.ts, debt.ts, challenges.ts (no-spend, day-by-day
                    clean/broken tracking), whatif.ts (hypothetical events on
                    a throwaway ledger copy, fed into runway.ts), runway.ts
                    (60-day cash projection)
    investments/  investments.ts, capitalGains.ts (FIFO lot-matching), crypto.ts,
                    quotes.ts + useLiveQuotes.ts (polls and caches live prices),
                    watchlist.ts, symbolSearch.ts
    tax/          irs.ts, fiscalCalendar.ts (IUC/IRS deadline dates, merged
                    and sorted), vehicles.ts
    insight/      analysis.ts, review.ts + replay.ts (month/year recap, and
                    the same figures animated one point at a time), worthIt.ts,
                    drill.ts, chartTables.ts, chartTheme.ts
    settings/     privacy.ts, density.ts, backup.ts, useAutoBackup.ts
  components/
    layout/     AppShell + Sidebar (tab navigation, icons)
    ui/          Shared primitives (Card, Button, Modal, ChartCard, Segmented, StatTile, …)
    overview/    The dashboard, itself grouped: charts/ (trend charts),
                  snapshot/ (this month's numbers), alerts/ (cards that render
                  nothing when there's nothing to flag), cards/ (accounts,
                  portfolio), tools/ (time travel, what-if, period review)
    entries/     Every input, split into Log (EntriesView's default) and Manage
                  via a Segmented control — recurring, expense form on Log;
                  accounts, budgets, rules, statement import, categories on Manage
    plan/        Goals, debt, no-spend challenges
    irs/         IRS deduction tracking, its own tab
    taxes/       Fiscal calendar (IRS deadline + vehicle IUC dates) and vehicles
    portfolio/   Holdings, trades, dividends, capital gains — what you own
    markets/     Watchlist, TradingView chart + technical/news/overview widgets
    settings/    Export/import, backup folder, appearance
```

Eight tabs: **Overview**, **Entries**, **Plan**, **IRS**, **Taxes**,
**Portfolio**, **Markets**, **Settings**. Taxes sits apart from IRS and Plan
on purpose — a filing deadline or a vehicle's IUC happens on a fixed day
regardless of anything you decide, which is a different kind of thing from a
goal you're steering or a deduction you're filing. Portfolio and Markets
used to be one "Markets" tab;
they split because owning ten shares of something and watching a symbol you
don't hold are different questions with different rhythms — one changes when
you trade, the other when you're just looking around. `SymbolPicker`
(`components/ui/`) is shared between them since both need to look up the same
instruments. Overview ships eagerly since it's the landing tab; every other tab
is a separate lazy chunk, so a session that never opens Markets never downloads
the TradingView embeds.

Every tab past Overview is a lazy chunk, so a card on one tab that needs to
send the reader to another (Overview's subscription alert linking to Entries →
Manage) can't just call a callback — the target likely isn't mounted yet.
`lib/navigate.ts` covers it with a `window` event plus a one-shot "pending
request" that a freshly-mounting tab reads in its own `useState` initializer,
so the request survives even when it arrives before anything is listening.

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
