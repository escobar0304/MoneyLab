import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import type { Tab } from './tabs';

/**
 * Two shells, one of which is always hidden.
 *
 * A phone gets a top bar and a bottom tab bar; anything wider gets the rail.
 * They are separate components rather than one that reshapes itself because
 * they share nothing but the tab list — the rail animates its own width and
 * carries a travelling marker, the bar has a sheet and a safe-area inset — and
 * a single component doing both was going to be a pile of conditionals with no
 * shape of its own.
 */
export function AppShell({
  active,
  onChange,
  children,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <MobileNav active={active} onChange={onChange} />
      <Sidebar active={active} onChange={onChange} />
      {/* The bottom padding clears the tab bar and the home indicator under it.
          Without it the last row of every page sits behind the bar, which on
          Entries is the submit button of the form you are filling in. */}
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
