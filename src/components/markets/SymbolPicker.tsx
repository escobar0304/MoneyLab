import { useEffect, useId, useRef, useState } from 'react';
import { searchCatalogue, searchRemote, type SymbolHit } from '../../lib/symbolSearch';
import { Input } from '../ui/primitives';

/** Long enough that typing "VWCE" is one request rather than four. */
const DEBOUNCE_MS = 220;

/**
 * Type-ahead for instruments.
 *
 * Answers from the bundled catalogue on the first keystroke and then replaces
 * those results with the live index if the proxy is reachable — so it is never
 * empty while waiting, and never blocks on a network that may not be there.
 *
 * A combobox rather than a `<datalist>`: datalist cannot show a second line of
 * description, cannot be styled to match anything, and renders differently in
 * every browser. Since a ticker is meaningless without its description ("MC" is
 * LVMH), that second line is the whole point.
 */
export function SymbolPicker({
  value,
  onChange,
  onPick,
  id,
  label = 'Symbol',
  placeholder = 'VWCE, Apple, BTC…',
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Fired when a result is chosen, with the resolved symbol and its description. */
  onPick?: (hit: SymbolHit) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;

  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const [active, setActive] = useState(0);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = searchCatalogue(value);
    setHits(local);
    setActive(0);

    if (value.trim().length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchRemote(value, controller.signal)
        .then((remote) => {
          if (controller.signal.aborted || remote.length === 0) return;
          setRemoteFailed(false);
          // Catalogue entries that the live index also returned would appear
          // twice, so the live result wins on id.
          const seen = new Set(remote.map((h) => h.id));
          setHits([...remote, ...local.filter((h) => !seen.has(h.id))]);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setRemoteFailed(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Clicking away closes the list without stealing the click from whatever was
  // clicked, which a blur handler on the input would do.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const choose = (hit: SymbolHit) => {
    onChange(hit.id);
    onPick?.(hit);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(hits.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % Math.max(hits.length, 1));
    } else if (e.key === 'Enter' && hits[active]) {
      // Only swallow Enter when there is a highlighted result — otherwise the
      // surrounding form's own submit-on-Enter must still work.
      e.preventDefault();
      choose(hits[active]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={inputId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        aria-label={label}
      />

      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface-2 py-1 shadow-xl shadow-black/50"
        >
          {hits.map((hit, i) => (
            <li
              key={`${hit.id}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault(); // keep focus in the field
                choose(hit);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-accent/12' : ''}`}
            >
              <p className="flex items-baseline gap-2 text-sm">
                <span className={`font-medium ${i === active ? 'text-accent' : 'text-ink'}`}>{hit.label}</span>
                <span className="truncate text-xs text-ink-muted">{hit.id}</span>
              </p>
              {hit.description && <p className="truncate text-xs text-ink-muted">{hit.description}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Said once, quietly, and only when it is actually true — the catalogue
          still works, so this is a note about reach, not a failure. */}
      {remoteFailed && open && (
        <p className="absolute right-0 -bottom-4 text-[10px] text-ink-muted">Offline — showing the built-in list</p>
      )}
    </div>
  );
}
