import type { ReactNode } from 'react';
import { TabNav, type Tab } from './TabNav';

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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur border-b border-neutral-800">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-100">MoneyLab</h1>
        </div>
        <div className="mx-auto max-w-6xl">
          <TabNav active={active} onChange={onChange} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
