import type { SVGProps } from 'react';

/**
 * The mark: a lab flask whose contents are a rising trend line, with the peak
 * picked out in the accent — the same accent dot the charts use to mark "now",
 * so the logo and the data speak the same visual language.
 *
 * Drawn on a 24px grid with a 1.6px stroke so it stays legible at the 20px the
 * collapsed sidebar renders it at.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 3h6M10 3v6.2L5.6 17.4a2.4 2.4 0 0 0 2.1 3.6h8.6a2.4 2.4 0 0 0 2.1-3.6L14 9.2V3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 17.4l2.3-2.4 1.9 1.5 2.4-2.9"
        stroke="var(--color-accent)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.2" cy="13.6" r="1.15" fill="var(--color-accent)" />
    </svg>
  );
}

export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-ink ${className}`}>
      Money<span className="text-accent">Lab</span>
    </span>
  );
}
