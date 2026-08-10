import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/Sidebar';
import { useStore } from './lib/store';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from './lib/animation';
import { useShortcuts } from './lib/shortcuts';
import { UndoToast } from './components/ui/UndoToast';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';
import { OverviewView } from './components/overview/OverviewView';

// Overview is the landing tab so it ships in the main chunk; the rest are split
// out. Markets in particular pulls in the TradingView embed, which most sessions
// never open.
const EntriesView = lazy(() => import('./components/entries/EntriesView').then((m) => ({ default: m.EntriesView })));
const MarketsView = lazy(() => import('./components/markets/MarketsView').then((m) => ({ default: m.MarketsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView })));

/** Holds the layout while a lazy chunk arrives, so switching tabs doesn't
 * collapse the page height and bounce the scroll position. */
function ViewFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [helpOpen, setHelpOpen] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const runRecurring = useStore((s) => s.runRecurring);
  const undo = useStore((s) => s.undo);

  useEffect(() => {
    runRecurring();
  }, [runRecurring]);

  const onNewExpense = useCallback(() => {
    setTab('entries');
    // Wait for the lazy chunk and the tab transition before reaching for the
    // field, otherwise focus lands on nothing.
    const focus = (attempt = 0) => {
      const el = document.getElementById('expense-amount');
      if (el instanceof HTMLInputElement) {
        el.focus();
        el.select();
      } else if (attempt < 20) {
        setTimeout(() => focus(attempt + 1), 50);
      }
    };
    focus();
  }, []);

  useShortcuts({
    onNavigate: setTab,
    onNewExpense,
    onUndo: undo,
    onHelp: () => setHelpOpen((v) => !v),
  });

  // Enter-only transition. An out-then-in cross-fade would delay the new page
  // behind an exit tween the reader has already stopped looking at — the tab
  // they clicked should be the thing that moves.
  useGSAP(
    () => {
      if (prefersReducedMotion() || !viewRef.current) return;
      gsap.fromTo(
        viewRef.current,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: DUR.base,
          ease: EASE.out,
          // Even `translate(0,0)` makes this element the containing block for
          // any `position: fixed` descendant, which quietly breaks overlays.
          clearProps: 'transform',
        }
      );
    },
    { dependencies: [tab] }
  );

  return (
    <AppShell active={tab} onChange={setTab}>
      <div ref={viewRef} key={tab}>
        <Suspense fallback={<ViewFallback />}>
          {tab === 'overview' && <OverviewView />}
          {tab === 'entries' && <EntriesView />}
          {tab === 'markets' && <MarketsView />}
          {tab === 'settings' && <SettingsView />}
        </Suspense>
      </div>
      <UndoToast />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </AppShell>
  );
}
