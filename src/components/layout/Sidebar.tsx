import { useRef, useState } from 'react';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { LogoMark, LogoWordmark } from './Logo';
import { IconOverview, IconEntries, IconSettings, IconChevronsLeft } from './icons';

export type Tab = 'overview' | 'entries' | 'settings';

const TABS: { id: Tab; label: string; Icon: typeof IconOverview }[] = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'entries', label: 'Entries', Icon: IconEntries },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

const COLLAPSED_KEY = 'moneylab-sidebar-collapsed';
const EXPANDED_W = 220;
const COLLAPSED_W = 68;

export function Sidebar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef(new Map<Tab, HTMLButtonElement>());

  // Width is animated rather than CSS-transitioned so the label fade can be
  // sequenced against it — labels leave before the panel narrows, and arrive
  // after it widens, instead of being squashed mid-transition.
  useGSAP(
    () => {
      const width = collapsed ? COLLAPSED_W : EXPANDED_W;
      if (prefersReducedMotion()) {
        gsap.set(asideRef.current, { width });
        gsap.set('.nav-label', { autoAlpha: collapsed ? 0 : 1 });
        return;
      }
      const tl = gsap.timeline();
      if (collapsed) {
        tl.to('.nav-label', { autoAlpha: 0, x: -6, duration: DUR.micro, ease: EASE.out })
          .to(asideRef.current, { width, duration: DUR.base, ease: EASE.inOut }, '-=0.05');
      } else {
        tl.to(asideRef.current, { width, duration: DUR.base, ease: EASE.inOut }).to(
          '.nav-label',
          { autoAlpha: 1, x: 0, duration: DUR.base, ease: EASE.out, stagger: 0.03 },
          '-=0.18'
        );
      }
    },
    { dependencies: [collapsed], scope: asideRef }
  );

  // A single accent rail that travels to whichever item is active, instead of
  // each item painting its own background. One moving object is easier to track
  // than three independent state changes.
  useGSAP(
    () => {
      const el = itemRefs.current.get(active);
      const nav = navRef.current;
      if (!el || !nav || !railRef.current) return;
      const top = el.offsetTop;
      const height = el.offsetHeight;
      gsap.to(railRef.current, {
        y: top,
        height,
        duration: prefersReducedMotion() ? 0 : DUR.base,
        ease: EASE.out,
      });
    },
    { dependencies: [active, collapsed] }
  );

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
  };

  return (
    <aside
      ref={asideRef}
      style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      className="sticky top-0 z-20 flex h-screen shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface-1"
    >
      <div className={`flex h-14 shrink-0 items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
        <LogoMark className="h-5.5 w-5.5 shrink-0 text-neutral-300" />
        {!collapsed && <LogoWordmark className="nav-label whitespace-nowrap" />}
      </div>

      <nav ref={navRef} className="relative flex flex-col gap-1 px-2.5 py-2">
        <span
          ref={railRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 rounded-lg bg-accent/12 ring-1 ring-inset ring-accent/25"
        />
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            ref={(node) => {
              if (node) itemRefs.current.set(id, node);
              else itemRefs.current.delete(id);
            }}
            type="button"
            onClick={() => onChange(id)}
            title={collapsed ? label : undefined}
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
            className={`relative z-10 flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              collapsed ? 'justify-center' : ''
            } ${active === id ? 'text-accent' : 'text-neutral-500 hover:text-neutral-200'}`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span className="nav-label">{label}</span>}
          </button>
        ))}
      </nav>

      <div className={`mt-auto flex h-14 shrink-0 items-center ${collapsed ? 'justify-center' : 'justify-end px-4'}`}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition-colors duration-200 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <IconChevronsLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </aside>
  );
}
