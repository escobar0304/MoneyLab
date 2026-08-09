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

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
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
