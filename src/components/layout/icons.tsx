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

/** IRS — a percent sign, the shape of a rate applied to a total. */
export function IconIrs(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 18 18 6" />
      <circle cx="7.5" cy="7.5" r="2.3" />
      <circle cx="16.5" cy="16.5" r="2.3" />
    </Icon>
  );
}

/** Portfolio — a briefcase. What you own carried in one case, distinct from
 * the candlesticks of Markets, which is about what's out there to look at. */
export function IconPortfolio(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="1.8" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </Icon>
  );
}

/** Taxes — a calendar with one date marked. The page is a list of dates that
 * matter, so the icon is the thing itself rather than a symbol for it. */
export function IconTaxes(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 3v3M16 3v3" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
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

/** Privacy mode, off — an open eye: the amounts are showing. */
export function IconEye(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Privacy mode, on — the same eye, struck through. The pair reads as one
 * control in two states rather than as two unrelated icons. */
export function IconEyeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.4 6.4A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.7-.72" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3.5 3.5l17 17" />
    </Icon>
  );
}
