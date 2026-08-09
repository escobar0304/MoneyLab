import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP, EASE, DUR } from '../../lib/animation';

/**
 * Choreographed entrance for a group of tiles. `grid: 'auto'` lets GSAP infer
 * the CSS grid's rows/columns and stagger diagonally rather than in flat DOM
 * order, so a bento layout resolves as a wave from the origin corner instead of
 * a top-to-bottom list.
 *
 * useGSAP runs in a layout effect, so the `autoAlpha: 0` start state is applied
 * before the browser paints — no flash of un-animated content, and no CSS
 * pre-hiding that would strand the content visible-less if the tween never ran.
 */
export function Reveal({
  children,
  className = '',
  from = 'start',
  stagger = 0.05,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  from?: 'start' | 'center' | 'edges';
  stagger?: number;
  delay?: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const targets = gsap.utils.toArray<HTMLElement>(scope.current!.children);
      if (targets.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(targets, { visibility: 'visible', clearProps: 'transform,opacity' });
      });
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          targets,
          { autoAlpha: 0, y: 14, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: DUR.base,
            ease: EASE.out,
            delay,
            stagger: { each: stagger, from, grid: 'auto' },
            // Transforms left on the element create a containing block, which
            // breaks `position: fixed` descendants (the modal) and blurs text.
            clearProps: 'transform',
          }
        );
      });
      return () => mm.revert();
    },
    { scope }
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
