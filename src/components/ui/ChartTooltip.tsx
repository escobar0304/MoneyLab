import { CHART_INK } from '../../lib/chartTheme';

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  payload?: { fill?: string };
}

/**
 * One shared tooltip renderer for every chart. Per the dataviz skill's interaction
 * guidance: a short line-key (not a filled box) identifies each series, and the
 * value leads while the series name follows — inverted from the legend, because
 * here the reader already has the series and wants the number.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // With one series there is nothing to tell apart, and the card title already
  // names what's plotted — so the series name is suppressed rather than echoing
  // the raw dataKey ("value") back at the reader.
  const showNames = payload.length > 1;

  return (
    // surface-2, one step above the card it floats over — on surface-1 it would
    // be the same colour as the card and read as a hole rather than a layer.
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg shadow-black/50">
      {label !== undefined && <p className="mb-1.5 text-ink-muted">{labelFormatter ? labelFormatter(label) : String(label)}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const value = Number(entry.value) || 0;
          const name = entry.name ?? '';
          const color = entry.color ?? entry.fill ?? entry.payload?.fill ?? CHART_INK.muted;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-semibold text-ink">{valueFormatter ? valueFormatter(value, name) : value}</span>
              {showNames && name && <span className="text-ink-muted">{name}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
