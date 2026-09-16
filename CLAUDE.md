# Working agreement

Conventions for Claude working in this repository.

## Branching and pull requests

Every feature goes on its own branch, never straight onto `main`:

1. **Branch off the current `main`** — `git fetch origin main` first, so the
   branch starts from what is actually published rather than whatever this
   session happened to have.
2. **Name it `feature/NAME_OF_THE_FEATURE`** — lowercase, hyphen-separated
   (`feature/csv-export`, `feature/demo-data`).
3. **Implement, then open a PR into `main`** when the work is finished and the
   checks below pass.
4. **The repository owner approves and merges.** Never merge a PR, and never
   push to `main`, without being asked to in that specific case.
5. **The remote branch deletes itself.** The repository has GitHub's
   *Automatically delete head branches* setting on, so merging the PR removes
   `origin/feature/…` with no one having to remember. What it does not touch is
   any local clone: clear those with `git fetch --prune` (drops the dead
   remote-tracking ref) and `git branch -d feature/NAME`.

Nobody needs to announce a merge. On the next session, check the PR's state
through the API rather than asking — and only then clean up whatever is left
locally, since a branch whose PR is still open must not be deleted.

Small, obvious fixes (a typo, a broken link, a README correction) can go
straight to `main`. Anything that changes behaviour or adds surface area takes
a branch. When it is not obvious which a change is, ask.

## Before every commit

- `npm run lint` (`tsc --noEmit`) — must be clean.
- `npm test` — must be green. Add tests for new behaviour rather than leaving
  it uncovered, especially anything touching stored data.
- `npm run build` for anything that could affect the bundle.
- UI changes get looked at in a real browser, not just typechecked. Say so
  explicitly when that was not possible.

## README

Keep `README.md` in step with the app. Update it whenever a change adds,
removes, or meaningfully reshapes a feature, the design system, or the project
structure — not on every commit, but whenever a reader relying on it would
otherwise be misled. The file says this about itself at the bottom, and it has
drifted before.

## Language

The interface is in **English**, and stays that way. A Portuguese translation
was tried and deliberately reverted — do not reintroduce one, or an i18n layer,
without being asked.

Note that money is formatted `pt-PT` while dates are formatted `en-US`
(`src/lib/core/format.ts`), so a row can read `1 234,56 €` next to
`Sep 25, 2026`. That inconsistency is known and untouched.

## Things this codebase cares about

- **The ledger is append-only.** Everything else is derived from `events`. Do
  not add mutable state that duplicates what a fold already computes.
- **Nothing leaves the device.** No CDNs in the critical path, no telemetry, no
  network calls beyond the TradingView embeds and the ECB/price lookups that
  are already there and already disclosed in the UI.
- **The chart palette is CVD-validated.** `src/lib/insight/chartTheme.ts`
  documents this — re-run the validator before changing its colours or order.
- **Comments explain *why*, not *what*.** Match the existing voice: they
  justify a decision or record a constraint that would otherwise be re-litigated.
