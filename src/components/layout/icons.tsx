import type { SVGProps } from 'react';

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

/** Overview — a bento of tiles, mirroring the dashboard's own layout. */
export function IconOverview(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="10" rx="1.6" />
      <rect x="13" y="3" width="8" height="6" rx="1.6" />
      <rect x="3" y="15" width="8" height="6" rx="1.6" />
      <rect x="13" y="11" width="8" height="10" rx="1.6" />
    </Icon>
  );
}

/** Entries — a pen over a line, i.e. writing something down. */
export function IconEntries(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="M4 21h16" />
    </Icon>
  );
}

/** Sliders. A cog at 18px collapses into a blob; radiating spokes read as a sun. */
export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.1" />
      <circle cx="9" cy="17" r="2.1" />
    </Icon>
  );
}

/** Markets — a candlestick pair, the form the panel actually shows. */
export function IconMarkets(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3v3.2M8 17.8V21M16 3v5.2M16 19.8V21" />
      <rect x="5.2" y="6.2" width="5.6" height="11.6" rx="1.4" />
      <rect x="13.2" y="8.2" width="5.6" height="11.6" rx="1.4" />
    </Icon>
  );
}

/** Plan — a target. Concentric rings survive 18px where a flag or a calendar
 * turns to mush, and "aiming at something" is what the page is about. */
export function IconPlan(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Icon>
  );
}

export function IconChevronsLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </Icon>
  );
}
