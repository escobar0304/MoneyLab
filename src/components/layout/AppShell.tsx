import type { ReactNode } from 'react';
import { Sidebar, type Tab } from './Sidebar';

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
    <div className="flex min-h-screen">
      <Sidebar active={active} onChange={onChange} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
