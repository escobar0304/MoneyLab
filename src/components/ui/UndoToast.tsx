import { useEffect, useRef } from 'react';
import { useStore } from '../../lib/core/store';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/core/animation';

/** How long the offer stands. Long enough to react to a misclick, short enough
 * that the snapshot never becomes a stale "undo something from ten minutes ago". */
const VISIBLE_MS = 8000;

/**
 * A single reversible action, offered right after it happens.
 *
 * This is what lets the rest of the app skip confirmation dialogs: undo after
 * the fact beats a modal before it, because the common case (you meant it) stops
 * costing a click.
 */
export function UndoToast() {
  const snapshot = useStore((s) => s.undoSnapshot);
  const undo = useStore((s) => s.undo);
  const dismiss = useStore((s) => s.dismissUndo);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [snapshot, dismiss]);

  useGSAP(
    () => {
      if (!snapshot || !ref.current || prefersReducedMotion()) return;
      gsap.fromTo(ref.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out });
    },
    { dependencies: [snapshot?.at] }
  );

  if (!snapshot) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      // Two things here are load-bearing on a phone.
      //
      // `w-max` and the viewport clamp: a `fixed` box with `left: 50%` and no
      // width can only grow to half the viewport before it starts wrapping, so
      // on a 390px screen this was a 195px column reading "Sample / data /
      // loaded" three words tall. It was invisible on a desktop, where half the
      // viewport is 720px.
      //
      // Top on a phone, bottom everywhere else: the bottom of a small screen
      // belongs to the tab bar and to whatever primary action is in reach of a
      // thumb — this toast was landing squarely on the "Log expense" button it
      // had just been triggered by. There is nothing at the top to collide with.
      className="fixed left-1/2 top-4 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-surface-2 py-2.5 pl-4 pr-2.5 float-material sm:bottom-5 sm:top-auto"
    >
      <span className="text-sm text-ink-secondary">{snapshot.label}</span>
      <button
        type="button"
        onClick={undo}
        className="cursor-pointer rounded-md px-2.5 py-1 text-sm font-semibold text-accent transition-colors duration-200 hover:bg-accent/12"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="cursor-pointer rounded-md px-1.5 py-1 text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
