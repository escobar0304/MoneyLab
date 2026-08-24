import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/Sidebar';
import { useStore } from './lib/store';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from './lib/animation';
import { useShortcuts } from './lib/shortcuts';
import { useLiveQuoteScheduler } from './lib/useLiveQuotes';
import { UndoToast } from './components/ui/UndoToast';
import { ShortcutsHelp } from './components/ui/ShortcutsHelp';
import { OverviewView } from './components/overview/OverviewView';
import { DrillPanel } from './components/entries/DrillPanel';

// Overview is the landing tab so it ships in the main chunk; the rest are split
// out. Markets in particular pulls in the TradingView embed, which most sessions
// never open.
const EntriesView = lazy(() => import('./components/entries/EntriesView').then((m) => ({ default: m.EntriesView })));
const PlanView = lazy(() => import('./components/plan/PlanView').then((m) => ({ default: m.PlanView })));
const IrsView = lazy(() => import('./components/irs/IrsView').then((m) => ({ default: m.IrsView })));
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
  const closeDrill = useStore((s) => s.closeDrill);

  // Leaving the page a drilled slice came from has to close it, or the panel
  // outlives the chart that opened it and describes a view no longer on screen.
  const changeTab = useCallback(
    (next: Tab) => {
      closeDrill();
      setTab(next);
    },
    [closeDrill]
  );

  // Mounted here, not inside Markets: Net worth on the Overview is only honest
  // if the portfolio behind it is priced, and mounting it in both places would
  // double every request.
  useLiveQuoteScheduler();

  useEffect(() => {
    runRecurring();
  }, [runRecurring]);

  const onNewExpense = useCallback(() => {
    changeTab('entries');
    // Wait for the lazy chunk and the tab transition before reaching for the
    // field, otherwise focus lands on nothing.
    // Five seconds, not one. The old budget assumed a warm cache; on a cold
    // load, or a slow connection, the chunk arrives after the polling gives up
    // and the keystroke silently does nothing.
    //
    // Being in the DOM is not enough to stop polling. Cards animate in with
    // GSAP's `autoAlpha`, which sets `visibility: hidden` at the start — and
    // focusing a hidden element silently does nothing. So the field is only
    // considered found once the focus has actually landed on it.
    const focus = (attempt = 0) => {
      const el = document.getElementById('expense-amount');
      if (el instanceof HTMLInputElement) {
        el.focus();
        if (document.activeElement === el) {
          el.select();
          return;
        }
      }
      if (attempt < 100) setTimeout(() => focus(attempt + 1), 50);
    };
    focus();
  }, [changeTab]);

  useShortcuts({
    onNavigate: changeTab,
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
    <AppShell active={tab} onChange={changeTab}>
      <div ref={viewRef} key={tab}>
        <Suspense fallback={<ViewFallback />}>
          {tab === 'overview' && <OverviewView />}
          {tab === 'entries' && <EntriesView />}
          {tab === 'plan' && <PlanView />}
          {tab === 'irs' && <IrsView />}
          {tab === 'markets' && <MarketsView />}
          {tab === 'settings' && <SettingsView />}
        </Suspense>
      </div>
      {/* Mounted once at the root rather than per view: any chart anywhere can
          open it, and one owner is what stops two marks opening two panels. */}
      <DrillPanel />
      <UndoToast />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </AppShell>
  );
}
