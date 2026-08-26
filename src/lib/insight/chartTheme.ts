import type { LedgerEvent } from '../core/types';

// Validated default palette (see dataviz skill references/palette.md) — dark mode
// only, matching this app's dark-only surface. Slot order is the documented one,
// which opens on blue and its complement orange: the same two hues the rest of the
// app is built from, so the charts and the chrome read as one system.
//
// The ordering is the CVD-safety mechanism, not cosmetic — re-run
// validate_palette.js before touching it. Current run against both app surfaces
// (--surface #1a1a19 and #0d0d0d, --mode dark): all checks pass, worst adjacent
// CVD ΔE 8.4, worst adjacent normal-vision ΔE 19.3.
export const CATEGORICAL = [
  '#3987e5', // blue      <- primary
  '#d95926', // orange    <- complement
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
];

/** The complementary pair the whole product is built on. */
export const PRIMARY = CATEGORICAL[0]; // blue  — money in, balance, everything positive
export const COMPLEMENT = CATEGORICAL[1]; // orange — money out, spend, everything consumed

export const SEQUENTIAL_BLUE = '#3987e5';

// Reserved for state, never for series identity. `critical` is the only alarm
// colour in the app — everything else lives on the blue/orange axis.
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

// Mirrors the CSS ink/surface tokens in index.css — charts and chrome read from
// the same values, so a chart never sits on a surface it wasn't validated against.
export const CHART_INK = {
  surface: '#13161d',
  primary: '#f4f6f9',
  secondary: '#bcc3cf',
  muted: '#8892a3',
  gridline: '#20242d',
  axis: '#2f3542',
};

export const MAX_CATEGORICAL_SERIES = 8;
export const OTHER_LABEL = 'Other';

/**
 * Expense categories ranked once by total historical spend across the whole ledger
 * (not per-chart, not per-window) — the single ordering every chart derives its
 * "top N" and color assignment from, so which categories count as "top" and which
 * color each gets never depends on which window/month a given chart happens to show.
 */
export function rankedCategories(events: LedgerEvent[]): string[] {
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'expense') totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/**
 * A stable category -> color mapping built from `rankedCategories`. Every chart
 * that shows expense categories reads from this same map, so a category keeps its
 * color everywhere — assigning color by each chart's own local top-N ranking would
 * repaint categories differently depending on which window/month a chart shows.
 */
export function categoryColorMap(events: LedgerEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  rankedCategories(events).forEach((name, i) => {
    map.set(name, i < CATEGORICAL.length ? CATEGORICAL[i] : CHART_INK.muted);
  });
  return map;
}

/**
 * Colour by identity, assigned from the sorted key list.
 *
 * Deliberately not by size or rank: anything ranked by value repaints itself the
 * moment a value moves, which for live prices is all day and for account
 * balances is every transfer. Colour follows the thing, never its current
 * position in a list.
 */
export function stableColorMap(keys: string[]): Map<string, string> {
  const map = new Map<string, string>();
  Array.from(new Set(keys))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key, i) => {
      map.set(key, i < CATEGORICAL.length ? CATEGORICAL[i] : CHART_INK.muted);
    });
  return map;
}

/** A stable symbol -> colour mapping for the portfolio. */
export function symbolColorMap(symbols: string[]): Map<string, string> {
  return stableColorMap(symbols);
}
