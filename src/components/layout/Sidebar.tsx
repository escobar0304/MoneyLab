import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/core/animation';
import { usePrivacy } from '../../lib/settings/privacy';
import { LogoMark, LogoWordmark } from './Logo';
import {
  IconOverview,
  IconEntries,
  IconPlan,
  IconIrs,
  IconTaxes,
  IconPortfolio,
  IconMarkets,
  IconSettings,
  IconChevronsLeft,
  IconEye,
  IconEyeOff,
} from '../ui/icons';

export type Tab = 'overview' | 'entries' | 'plan' | 'irs' | 'taxes' | 'portfolio' | 'markets' | 'settings';

const TABS: { id: Tab; label: string; Icon: typeof IconOverview }[] = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'entries', label: 'Entries', Icon: IconEntries },
  { id: 'plan', label: 'Plan', Icon: IconPlan },
  { id: 'irs', label: 'IRS', Icon: IconIrs },
  { id: 'taxes', label: 'Taxes', Icon: IconTaxes },
  { id: 'portfolio', label: 'Portfolio', Icon: IconPortfolio },
  { id: 'markets', label: 'Markets', Icon: IconMarkets },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

const COLLAPSED_KEY = 'moneylab-sidebar-collapsed';
const EXPANDED_W = 220;
const COLLAPSED_W = 68;

/** Below this the expanded rail costs more than half the viewport, so it
 * collapses whatever the stored preference says. */
const NARROW = '(max-width: 639px)';

export function Sidebar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const [preferCollapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);

  // Forced, not stored: a phone shouldn't silently rewrite the preference the
  // same person set on their desktop — the ledger syncs through an exported
  // file, but this key is per-browser and would be theirs to find wrong later.
  const collapsed = narrow || preferCollapsed;

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChangeMq = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChangeMq);
    return () => mq.removeEventListener('change', onChangeMq);
  }, []);
  const [hidden, setHidden] = usePrivacy();
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
    const next = !preferCollapsed;
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
        <LogoMark className="h-5.5 w-5.5 shrink-0 text-ink-secondary" />
        {!collapsed && <LogoWordmark className="nav-label whitespace-nowrap" />}
      </div>

      <nav ref={navRef} className="relative flex flex-col gap-1 px-2.5 py-2">
        {/* `top-0` is load-bearing: without it the rail's static position already
            sits below the nav's padding, so translating it by the button's
            offsetTop would double-count that padding and park it a row low.
            The inset matches the nav padding so the rail tracks the button width. */}
        {/* The travelling marker. A filled pill made the active item look like
            a button someone had left pressed; a lit edge with the faintest
            wash behind it reads as a selector on a panel — the item is being
            pointed at rather than highlighted. The 2px bar is the same mark
            the section titles use, so "this one" looks the same everywhere. */}
        <span
          ref={railRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-2.5 right-2.5 overflow-hidden rounded-md bg-gradient-to-r from-accent/14 to-transparent"
        >
          <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
        </span>
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
            className={`font-display relative z-10 flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-semibold tracking-tight transition-colors duration-200 ${
              collapsed ? 'justify-center' : ''
            } ${active === id ? 'text-accent' : 'text-ink-muted hover:text-ink-secondary'}`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span className="nav-label">{label}</span>}
          </button>
        ))}
      </nav>

      <div className={`mt-auto flex h-14 shrink-0 items-center gap-1 ${collapsed ? 'justify-center' : 'justify-end px-4'}`}>
        {/* In the shell rather than on a page: hiding the figures is something
            you do *before* turning the screen round, and hunting through
            Settings while someone watches rather defeats the point. */}
        <button
          type="button"
          onClick={() => setHidden(!hidden)}
          aria-pressed={hidden}
          title={hidden ? 'Show amounts' : 'Hide amounts'}
          aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 ${
            hidden ? 'bg-accent/12 text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          }`}
        >
          {hidden ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        </button>
        {/* Hidden rather than disabled on a narrow screen: the rail is forced
            collapsed there, so the control has nothing it could do. */}
        {!narrow && (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <IconChevronsLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </aside>
  );
}
