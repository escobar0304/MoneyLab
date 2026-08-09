import type { LedgerEvent } from './types';

// Validated default palette (see dataviz skill references/palette.md) — dark mode only,
// matching this app's dark-only surface. Validated via validate_palette.js --mode dark
// --surface #1a1a19 (all checks pass).
export const CATEGORICAL = [
  '#3987e5', // blue
  '#008300', // green
  '#d55181', // magenta
  '#c98500', // yellow
  '#199e70', // aqua
  '#d95926', // orange
  '#9085e9', // violet
  '#e66767', // red
];

export const SEQUENTIAL_BLUE = '#3987e5';
export const SEQUENTIAL_GREEN = '#008300';
export const SEQUENTIAL_VIOLET = '#9085e9';

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export const CHART_INK = {
  surface: '#1a1a19',
  primary: '#ffffff',
  secondary: '#c3c2b7',
  muted: '#898781',
  gridline: '#2c2c2a',
  axis: '#383835',
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
