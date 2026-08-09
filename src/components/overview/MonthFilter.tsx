import { monthLabel } from '../../lib/format';

/**
 * One filter, scoping every "this month" tile/chart below it — never a picker per
 * chart (see dataviz skill interaction.md: "one filter row above everything it
 * scopes; all charts re-render against the same slice").
 */
export function MonthFilter({ month, months, onChange }: { month: string; months: string[]; onChange: (month: string) => void }) {
  const index = months.indexOf(month);
  const canPrev = index > 0;
  const canNext = index !== -1 && index < months.length - 1;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous month"
        disabled={!canPrev}
        onClick={() => canPrev && onChange(months[index - 1])}
        className="rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        ‹
      </button>
      <span className="min-w-[8.5rem] text-center text-sm font-medium text-ink">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="Next month"
        disabled={!canNext}
        onClick={() => canNext && onChange(months[index + 1])}
        className="rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}
