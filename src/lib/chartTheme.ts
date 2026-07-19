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
