import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/core/animation';
import { usePrivacy } from '../../lib/settings/privacy';
import { LogoMark, LogoWordmark } from './Logo';
import { PRIMARY_TABS, SECONDARY_TABS, tabDef, type Tab } from './tabs';
import { IconMore, IconClose, IconEye, IconEyeOff } from '../ui/icons';

/**
 * What the shell is on a phone.
 *
 * The rail collapsed to icons below 640px, which kept the whole navigation on
 * screen but spent 68px — a sixth of a 390px viewport — on it permanently, for
 * eight destinations of which one is in use. A ledger row then had two thirds
 * of the width it needed, which is why "Dinner out" was arriving as "Dinne…".
 *
 * So on a phone the navigation moves to where a phone expects it: a bar at the
 * bottom, in reach of a thumb, and a thin top bar carrying the mark and the one
 * control that has to be instant. Four destinations are permanent and the rest
 * are behind More — see `tabs.ts` for why those four.
 *
 * Everything here is `sm:hidden`. The desktop rail is untouched, and neither
 * ever renders while the other is visible.
 */
export function MobileNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hidden, setHidden] = usePrivacy();

  // Opening a destination is what the sheet is for, so it closes itself rather
  // than making you dismiss it afterwards.
  const go = (tab: Tab) => {
    setSheetOpen(false);
    onChange(tab);
  };

  const moreActive = SECONDARY_TABS.includes(active);

  return (
    <>
      {/* The mark earns its place by being the only thing that says which app
          this is once the rail is gone. The eye sits beside it because hiding
          the figures is something you do before turning the screen round, and
          two taps into a sheet is two taps too many for that. */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-hairline bg-surface-1/90 px-4 backdrop-blur-sm sm:hidden">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5 text-ink-secondary" />
          <LogoWordmark />
        </div>
        <button
          type="button"
          onClick={() => setHidden(!hidden)}
          aria-pressed={hidden}
          aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors duration-200 ${
            hidden ? 'bg-accent/12 text-accent' : 'text-ink-muted'
          }`}
        >
          {hidden ? <IconEyeOff className="h-4.5 w-4.5" /> : <IconEye className="h-4.5 w-4.5" />}
        </button>
      </header>

      {/* `pb-[env(safe-area-inset-bottom)]` rather than a fixed offset: on a
          phone with a home indicator the bar has to clear it, and on one
          without, the variable resolves to 0 and costs nothing. The viewport
          meta already carries `viewport-fit=cover`, which is what makes the
          value non-zero when it should be. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
      >
        <ul className="flex items-stretch">
          {PRIMARY_TABS.map((id) => {
            const { label, Icon } = tabDef(id);
            return (
              <li key={id} className="flex-1">
                <TabButton label={label} selected={active === id} onClick={() => onChange(id)}>
                  <Icon className="h-5 w-5" />
                </TabButton>
              </li>
            );
          })}
          <li className="flex-1">
            <TabButton
              label="More"
              selected={moreActive}
              expanded={sheetOpen}
              onClick={() => setSheetOpen((open) => !open)}
            >
              <IconMore className="h-5 w-5" />
            </TabButton>
          </li>
        </ul>
      </nav>

      {sheetOpen && <MoreSheet active={active} onPick={go} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

/**
 * One slot on the bar.
 *
 * 56px tall before the safe area, which clears the 44px minimum a touch target
 * needs with room for the label — and the label stays rather than being implied
 * by the icon, because eight of these icons were drawn to be read next to their
 * names in the rail, not instead of them.
 */
function TabButton({
  label,
  selected,
  expanded,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected && expanded === undefined ? 'page' : undefined}
      aria-expanded={expanded}
      className={`relative flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-200 ${
        selected ? 'text-accent' : 'text-ink-muted'
      }`}
    >
      {/* The same 2px accent mark the rail and the section titles use, moved to
          the top edge because that is the edge facing the page here. */}
      {selected && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" />}
      {children}
      <span className="font-display text-[0.6875rem] font-semibold tracking-tight">{label}</span>
    </button>
  );
}

/**
 * The other four destinations.
 *
 * A sheet rising from the bar rather than a drawer from the side: it belongs to
 * the control that opened it and should look like it came out of it. Portalled
 * for the same reason the modal is — any GSAP transform left on an ancestor
 * would otherwise make `fixed` resolve against that ancestor instead of the
 * viewport, and a Card's `overflow: hidden` would clip this to a sliver.
 */
function MoreSheet({ active, onPick, onClose }: { active: Tab; onPick: (tab: Tab) => void; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(panelRef.current, { yPercent: 100, duration: DUR.base, ease: EASE.out });
    },
    { scope: panelRef }
  );

  return createPortal(
    <div className="fixed inset-0 z-40 sm:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="More"
        // Clears the tab bar it rose out of, so the bar stays visible and the
        // sheet does not look like it replaced the navigation.
        className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] rounded-t-2xl border-t border-hairline bg-surface-1 pb-2"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="t-label">More</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <ul>
          {SECONDARY_TABS.map((id) => {
            const { label, Icon } = tabDef(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onPick(id)}
                  aria-current={active === id ? 'page' : undefined}
                  className={`flex w-full cursor-pointer items-center gap-3 border-t border-hairline px-4 py-3.5 text-left transition-colors duration-200 ${
                    active === id ? 'text-accent' : 'text-ink-secondary'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="font-display text-sm font-semibold tracking-tight">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body
  );
}
