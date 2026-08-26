import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * Shared motion vocabulary. Every animation in the app pulls its easing and
 * duration from here so the whole product moves with one accent instead of each
 * component inventing its own.
 *
 * `power3.out` rather than a `back.out` overshoot: on dense, informational UI an
 * overshoot reads as sloppy — numbers that bounce past their value and settle
 * back look like the data changed twice.
 */
export const EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  /** For marks that grow from a baseline (bars, meters) — decisive, no wobble. */
  draw: 'expo.out',
} as const;

export const DUR = {
  micro: 0.18,
  base: 0.34,
  draw: 0.75,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, useGSAP };
