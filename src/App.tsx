import { useEffect, useRef, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/Sidebar';
import { useStore } from './lib/store';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from './lib/animation';
import { OverviewView } from './components/overview/OverviewView';
import { EntriesView } from './components/entries/EntriesView';
import { SettingsView } from './components/settings/SettingsView';

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const viewRef = useRef<HTMLDivElement>(null);
  const runSalarySimulation = useStore((s) => s.runSalarySimulation);

  useEffect(() => {
    runSalarySimulation();
  }, [runSalarySimulation]);

  // Enter-only transition. An out-then-in cross-fade would delay the new page
  // behind an exit tween the reader has already stopped looking at — the tab
  // they clicked should be the thing that moves.
  useGSAP(
    () => {
      if (prefersReducedMotion() || !viewRef.current) return;
      gsap.fromTo(viewRef.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out });
    },
    { dependencies: [tab] }
  );

  return (
    <AppShell active={tab} onChange={setTab}>
      <div ref={viewRef} key={tab}>
        {tab === 'overview' && <OverviewView />}
        {tab === 'entries' && <EntriesView />}
        {tab === 'settings' && <SettingsView />}
      </div>
    </AppShell>
  );
}
