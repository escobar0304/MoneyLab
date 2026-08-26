import type { ReactNode } from 'react';
import { CHART_INK } from '../../lib/insight/chartTheme';
import { formatMoneyCompact } from '../../lib/core/format';

/**
 * One definition of chart furniture for the whole app.
 *
 * Each chart used to declare its own axes, grid and legend, which is how they
 * drifted into looking like three separate widgets parked on top of the cards
 * rather than part of them. Everything recessive lives here now; the chart files
 * are left with only the marks — the part that is actually about the data.
 */

/** Every timeline plot is the same height, so cards sitting side by side line up. */
export const PLOT_HEIGHT = 232;

/** No axis rules at all. The gridlines already say where the plot is, and a
 * second boundary line is chrome the rest of the app doesn't have. */
export const gridProps = {
  stroke: CHART_INK.gridline,
  vertical: false,
  strokeWidth: 1,
} as const;

const tick = { fill: CHART_INK.muted, fontSize: 11, fontFamily: 'inherit' } as const;

export const xAxisProps = {
  stroke: 'transparent',
  tick,
  tickLine: false,
  axisLine: false,
  dy: 4,
  minTickGap: 24,
} as const;

/** Compact ticks, so the y-axis takes 44px instead of ~70 and reads as a quiet
 * scale rather than a column of prices. */
export const yAxisProps = {
  stroke: 'transparent',
  tick,
  tickLine: false,
  axisLine: false,
  width: 46,
  allowDecimals: false,
  tickFormatter: (v: number) => formatMoneyCompact(v),
} as const;

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * A y-scale that lands on numbers a person would actually choose.
 *
 * Recharts derives ticks from the data's own extent, so a maximum of 1 643 gives
 * 450 / 900 / 1,4k — evenly spaced but arbitrary, and the reader has to decode
 * the scale before reading the bar. This rounds the step up to the nearest
 * 1/2/2.5/5/10 × 10ⁿ so the axis reads 0 / 500 / 1k / 1,5k / 2k instead.
 *
 * Returns null for domains crossing zero, where a zero-anchored scale would be
 * the wrong answer — those fall back to Recharts' own handling.
 */
/**
 * The same rounding for a scale that isn't anchored at zero.
 *
 * A savings rate runs from negative to positive, so `niceScale`'s zero floor is
 * wrong for it — but a raw min/max domain gives ticks like -14 / 16 / 46 / 76 /
 * 101, which are as arbitrary as they look.
 */
export function niceSpan(lo: number, hi: number, targetTicks = 5): { domain: [number, number]; ticks: number[] } {
  const low = Math.min(lo, hi);
  const high = Math.max(lo, hi);
  const span = high - low || Math.abs(high) || 1;
  const rawStep = span / (targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = (NICE_STEPS.find((s) => s * magnitude >= rawStep) ?? 10) * magnitude;

  const bottom = Math.floor(low / step) * step;
  const top = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [bottom, top], ticks };
}

export function niceScale(max: number, targetTicks = 5): { domain: [number, number]; ticks: number[] } | null {
  if (!Number.isFinite(max) || max <= 0) return null;
  const rawStep = max / (targetTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = (NICE_STEPS.find((s) => s * magnitude >= rawStep) ?? 10) * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [0, top], ticks };
}

export const crosshair = { stroke: CHART_INK.axis, strokeWidth: 1 } as const;
export const barCursor = { fill: CHART_INK.gridline, opacity: 0.5 } as const;

/** Margins that let the plot sit flush inside the card's own padding instead of
 * adding a second, inconsistent inset. `top` leaves room for endpoint labels. */
export const plotMargin = { top: 18, right: 6, left: 0, bottom: 0 } as const;

interface LegendEntry {
  value?: string;
  color?: string;
}

/**
 * Replaces Recharts' default legend, which centres itself under the plot with
 * boxy swatches and its own font metrics. This one is a quiet row above the
 * plot using the same line-key and ink the tooltips and the dumbbell legend use,
 * so identity looks the same everywhere it appears.
 */
export function ChartLegend({ payload }: { payload?: LegendEntry[] }) {
  if (!payload || payload.length === 0) return null;
  return (
    <ul className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      {payload.map((entry) => (
        <li key={entry.value} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

/** Endpoint value label. Muted ink and the app's own font, so it reads as a
 * caption on the chart rather than a graphic drawn into it. */
export function EndpointLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <text x={x - 9} y={y - 11} textAnchor="end" fontSize={11} fontFamily="inherit" fill={CHART_INK.muted} className="money">
      {children}
    </text>
  );
}

/** Wrapper giving every plot the same height and letting SVG text inherit the
 * app's typeface instead of the browser's SVG default. */
export function Plot({ height = PLOT_HEIGHT, children }: { height?: number; children: ReactNode }) {
  return (
    <div className="w-full font-sans" style={{ height }}>
      {children}
    </div>
  );
}
