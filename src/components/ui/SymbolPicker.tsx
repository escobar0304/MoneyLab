import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchCatalogue, searchRemote, type SymbolHit } from '../../lib/investments/symbolSearch';
import { Input } from './primitives';

/** Long enough that typing "VWCE" is one request rather than four. */
const DEBOUNCE_MS = 220;

/** Preferred height of the list, and the threshold for flipping it above the
 * field when the space below is smaller than this. */
const MAX_LIST_H = 288;

interface ListBox {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

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
 *
 * Lives in `ui/` rather than under one tab: Portfolio uses it to add a holding,
 * Markets uses it to add a watchlist symbol, and both need the exact same
 * lookup rather than two that could quietly drift apart.
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
  const [loading, setLoading] = useState(false);
  const [box, setBox] = useState<ListBox | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const local = searchCatalogue(value);
    setHits(local);
    setActive(0);

    if (value.trim().length < 2) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchRemote(value, controller.signal)
        .then((remote) => {
          if (controller.signal.aborted) return;
          setRemoteFailed(false);
          setLoading(false);
          if (remote.length === 0) return;
          // Catalogue entries that the live index also returned would appear
          // twice, so the live result wins on id.
          const seen = new Set(remote.map((h) => h.id));
          setHits([...remote, ...local.filter((h) => !seen.has(h.id))]);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setRemoteFailed(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Clicking away closes the list without stealing the click from whatever was
  // clicked, which a blur handler on the input would do. The list itself lives
  // in a portal, so it has to be checked separately from the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  /**
   * Anchors the list to the field from outside the layout.
   *
   * Every panel in this app is a `Card`, and `Card` is `overflow-hidden` for its
   * spotlight — so an absolutely positioned dropdown gets sliced off at the card
   * edge. The portal takes the list out of that subtree entirely and positions
   * it against the viewport, which also lets it flip above the field when there
   * is no room below.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const field = containerRef.current;
      if (!field) return;
      const r = field.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const flip = below < MAX_LIST_H && r.top > below;
      setBox({
        left: r.left,
        width: r.width,
        top: flip ? undefined : r.bottom + 4,
        bottom: flip ? window.innerHeight - r.top + 4 : undefined,
        maxHeight: Math.max((flip ? r.top : below) - 12, 120),
      });
    };

    place();
    // Capture, so a scroll inside any container moves the list with the field
    // rather than leaving it stranded mid-page.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, hits.length]);

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
    } else if (e.key === 'Enter' && hits.length === 0 && value.trim()) {
      // Nothing matched, so take the text as typed — TradingView accepts far
      // more symbols than any search will surface, and refusing to accept what
      // someone deliberately wrote is worse than offering a wrong suggestion.
      e.preventDefault();
      setOpen(false);
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

      {/* Rendered whenever the box is open with something typed — including with
          no results. A dropdown that simply fails to appear is indistinguishable
          from a feature that does not work. */}
      {open && box && (hits.length > 0 || value.trim().length > 0) &&
        createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          style={{
            position: 'fixed',
            left: box.left,
            width: box.width,
            top: box.top,
            bottom: box.bottom,
            maxHeight: Math.min(box.maxHeight, MAX_LIST_H),
          }}
          className="z-50 overflow-y-auto rounded-lg border border-border bg-surface-2 py-1 shadow-xl shadow-black/50"
        >
          {hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-muted">
              {loading ? (
                'Searching…'
              ) : (
                <>
                  Nothing found for “{value.trim()}”. Press <kbd className="rounded bg-surface-0 px-1">Enter</kbd> to use it as
                  typed, or try a ticker such as <span className="text-ink-secondary">VWCE</span>.
                </>
              )}
            </li>
          )}
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

          {/* Footer notes live inside the list rather than under the field: the
              card around this has `overflow-hidden`, so anything hanging below
              the input is liable to be clipped away unseen. */}
          {hits.length > 0 && loading && (
            <li className="border-t border-hairline px-3 py-1.5 text-xs text-ink-muted">Still searching TradingView…</li>
          )}
          {hits.length > 0 && remoteFailed && (
            <li className="border-t border-hairline px-3 py-1.5 text-xs text-ink-muted">
              Search unavailable — showing the built-in list only.
            </li>
          )}
        </ul>,
          document.body
        )}
    </div>
  );
}
