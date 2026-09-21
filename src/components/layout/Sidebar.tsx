import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/core/animation';
import { usePrivacy } from '../../lib/settings/privacy';
import { LogoMark, LogoWordmark } from './Logo';
import { IconChevronsLeft, IconEye, IconEyeOff } from '../ui/icons';
import { TABS, type Tab } from './tabs';

export type { Tab };

const COLLAPSED_KEY = 'moneylab-sidebar-collapsed';
const EXPANDED_W = 220;
const COLLAPSED_W = 68;

/**
 * Below this the phone shell takes over entirely — see `MobileNav`.
 *
 * The rail used to stay and collapse to icons here, which is why this matters
 * beyond hiding a panel: `useGSAP` tweens the aside's width on mount, and a
 * hidden-but-mounted rail would still be measuring and animating a panel nobody
 * can see. Returning null is cheaper and, more to the point, leaves exactly one
 * navigation in the accessibility tree at any width.
 */
const NARROW = '(max-width: 639px)';

export function Sidebar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const [preferCollapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);

  // Only the stored preference now. The forced-collapse case this used to carry
  // was the phone, and the phone no longer renders this at all.
  const collapsed = preferCollapsed;

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

  // After every hook, never before: the rail mounts and unmounts as the window
  // crosses the breakpoint, and an early return above the hooks would change
  // their order between those two renders.
  if (narrow) return null;

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
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <IconChevronsLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </aside>
  );
}
