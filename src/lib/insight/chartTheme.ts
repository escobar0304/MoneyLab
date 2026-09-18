import type { LedgerEvent } from '../core/types';

// Two validated palettes, one per theme — a light palette is not a dark one
// inverted, and the skill that supplied these says so explicitly: each mode
// gets its own steps, validated against its own surface.
//
// Six of the eight slots are shared. Only gold and violet are re-stepped for
// paper, where the dark theme's versions fall below 3:1 against the surface
// (2.9 and 2.95) — everything else already cleared. Keeping the other six
// identical is deliberate: the two themes stay recognisably the same product.
//
// The ordering is the CVD-safety mechanism, not cosmetic. Re-run
// validate_palette.js before touching either.
//
//   ink   (--surface #13161d --mode dark):  all pass, worst adjacent CVD ΔE 8.4, normal 19.3
//   paper (--surface #faf8f5 --mode light): all pass, worst adjacent CVD ΔE 9.4, normal 18.1
const CATEGORICAL_INK = [
  '#3987e5', // blue      <- primary
  '#d95926', // orange    <- complement
  '#199e70', // aqua
  '#c98500', // gold
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
];

const CATEGORICAL_PAPER = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#a86f00', // gold, darkened — #c98500 reads 2.9:1 on paper
  '#d55181',
  '#008300',
  '#6f61d9', // violet, darkened — #9085e9 reads 2.95:1 on paper
  '#e66767',
];

function onPaper(): boolean {
  // Defaults to paper, matching `readTheme`, so a chart rendered before the
  // root attribute is set (tests, SSR-ish paths) picks the default rather than
  // silently using the other theme's steps.
  return typeof document === 'undefined' || document.documentElement.dataset.theme !== 'ink';
}

/** The categorical palette for the theme currently on the document. */
export function categorical(): string[] {
  return onPaper() ? CATEGORICAL_PAPER : CATEGORICAL_INK;
}

/** Kept only for anything reading a palette without a theme in hand. Prefer
 * `categorical()`, which follows the theme on the document. */
export const CATEGORICAL = CATEGORICAL_INK;

/** The complementary pair the whole product is built on. Identical in both
 * themes, which is why they can be constants. */
export const PRIMARY = '#3987e5'; // blue  — money in, balance, everything positive
export const COMPLEMENT = '#d95926'; // orange — money out, spend, everything consumed

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
const INK_CHROME = {
  surface: '#13161d',
  primary: '#f4f6f9',
  secondary: '#bcc3cf',
  muted: '#8892a3',
  gridline: '#20242d',
  axis: '#2f3542',
};

const PAPER_CHROME = {
  surface: '#ffffff',
  primary: '#1a1814',
  secondary: '#4a453d',
  muted: '#6b6459',
  gridline: '#eae5dc',
  axis: '#d4cec2',
};

/**
 * Chart chrome for the theme on the document — mirrors the CSS ink/surface
 * tokens, so a chart never sits on a surface it was not validated against.
 *
 * A getter rather than a constant because the theme can change while the app is
 * running, and the old shape was read once at module load. Every property is
 * live, so existing `CHART_INK.muted` call sites keep working and start
 * following the theme without being touched.
 */
export const CHART_INK: typeof INK_CHROME = {
  get surface() {
    return onPaper() ? PAPER_CHROME.surface : INK_CHROME.surface;
  },
  get primary() {
    return onPaper() ? PAPER_CHROME.primary : INK_CHROME.primary;
  },
  get secondary() {
    return onPaper() ? PAPER_CHROME.secondary : INK_CHROME.secondary;
  },
  get muted() {
    return onPaper() ? PAPER_CHROME.muted : INK_CHROME.muted;
  },
  get gridline() {
    return onPaper() ? PAPER_CHROME.gridline : INK_CHROME.gridline;
  },
  get axis() {
    return onPaper() ? PAPER_CHROME.axis : INK_CHROME.axis;
  },
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
  const palette = categorical();
  rankedCategories(events).forEach((name, i) => {
    map.set(name, i < palette.length ? palette[i] : CHART_INK.muted);
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
  const palette = categorical();
  Array.from(new Set(keys))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key, i) => {
      map.set(key, i < palette.length ? palette[i] : CHART_INK.muted);
    });
  return map;
}

/** A stable symbol -> colour mapping for the portfolio. */
export function symbolColorMap(symbols: string[]): Map<string, string> {
  return stableColorMap(symbols);
}
