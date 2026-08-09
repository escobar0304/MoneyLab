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

  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs shadow-lg shadow-black/40">
      {label !== undefined && <p className="mb-1.5 text-neutral-400">{labelFormatter ? labelFormatter(label) : String(label)}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const value = Number(entry.value) || 0;
          const name = entry.name ?? '';
          const color = entry.color ?? entry.fill ?? entry.payload?.fill ?? '#898781';
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-semibold text-neutral-100">{valueFormatter ? valueFormatter(value, name) : value}</span>
              {name && <span className="text-neutral-500">{name}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
