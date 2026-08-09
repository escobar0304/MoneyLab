import { useRef } from 'react';
import { gsap, useGSAP, EASE, prefersReducedMotion } from '../../lib/animation';

/**
 * Counts from the previous value to the new one instead of snapping.
 *
 * The tween drives a plain object and writes `textContent` directly rather than
 * going through React state — a counter re-rendering the tree 60 times a second
 * would re-render every sibling tile with it.
 */
export function AnimatedNumber({
  value,
  format,
  className = '',
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (prefersReducedMotion()) {
        shown.current = value;
        el.textContent = format(value);
        return;
      }

      const counter = { n: shown.current };
      gsap.to(counter, {
        n: value,
        duration: Math.abs(value - shown.current) > 0 ? 0.9 : 0,
        ease: EASE.out,
        onUpdate: () => {
          el.textContent = format(counter.n);
        },
        onComplete: () => {
          shown.current = value;
          el.textContent = format(value);
        },
      });
    },
    { dependencies: [value, format] }
  );

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
