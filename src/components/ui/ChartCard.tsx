import { useId, useState, type ReactNode } from 'react';
import { Card, TitleTick, type CardLevel } from './primitives';
import type { TableData } from '../../lib/insight/chartTables';

/**
 * A chart panel with an accessible table twin behind a toggle.
 *
 * A chart encodes values as position and colour — neither of which a screen
 * reader can read, and colour is unreliable under colour-vision deficiency. The
 * table is the same data in a form that always works, so no value in the app is
 * reachable only by looking at a picture.
 */
export function ChartCard({
  title,
  subtitle,
  table,
  children,
  className = '',
  level = 'default',
}: {
  title: string;
  subtitle?: string;
  table?: TableData;
  children: ReactNode;
  className?: string;
  level?: CardLevel;
}) {
  const [showTable, setShowTable] = useState(false);
  const regionId = useId();

  return (
    <Card className={className} level={level}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          {/* The same mark SectionTitle carries. A page mixing panels that have
              it with panels that don't reads as two different designs. */}
          <TitleTick className="mt-1 h-3.5" />
          <div className="min-w-0">
            <p className="t-title text-ink">{title}</p>
            {subtitle && <p className="t-caption mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            aria-controls={regionId}
            className={`shrink-0 cursor-pointer rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-200 ${
              showTable ? 'border-accent/40 bg-accent/12 text-accent' : 'border-hairline text-ink-muted hover:border-border hover:text-ink-secondary'
            }`}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>

      {/* Named group rather than a bare div: a chart is a region a reader
          navigates to, and without a name it announces as "group" with no
          indication of which of the nine on this page it is. */}
      <div id={regionId} role="group" aria-label={title} className="mt-3">
        {showTable && table ? <DataTable data={table} caption={title} /> : children}
      </div>
    </Card>
  );
}

/**
 * Says once, for the whole page, that the marks open.
 *
 * It used to sit on every drillable card, which put the identical sentence on
 * screen seven times — noise that made the page look busier without making the
 * interaction any more discoverable than saying it once, at the top, where
 * reading starts.
 */
export function DrillHint() {
  return (
    <p className="t-caption flex items-center gap-1.5">
      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M2 1.4 9.6 5.3 6.4 6.4 5.3 9.6 2 1.4Z" />
      </svg>
      Everything below opens — click a slice, a bar, a meter or a figure to see the entries behind it.
    </p>
  );
}

function DataTable({ data, caption }: { data: TableData; caption: string }) {
  if (data.rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">No data for this period.</p>;
  }

  return (
    // Wide tables scroll inside their own container rather than pushing the page
    // sideways.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {data.columns.map((col, i) => (
              <th
                key={col}
                scope="col"
                className={`border-b border-hairline pb-2 text-xs font-medium text-ink-muted ${
                  data.numeric.includes(i) ? 'text-right' : 'text-left'
                } ${i > 0 ? 'pl-3' : ''}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => (
            <tr key={r} className="border-b border-hairline/60 last:border-b-0">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`py-2 ${data.numeric.includes(c) ? 'num-col text-right text-ink-secondary' : 'text-left text-ink-secondary'} ${
                    c > 0 ? 'pl-3' : ''
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
