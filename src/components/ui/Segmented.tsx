/** A segmented control — one row, above everything it scopes. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-hairline bg-surface-0 p-0.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
            value === o.id ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
