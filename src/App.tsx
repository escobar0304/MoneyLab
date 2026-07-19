import { lazy, Suspense, useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/TabNav';
import { useStore } from './lib/store';
import { Dashboard } from './components/home/Dashboard';
import { BucketsView } from './components/buckets/BucketsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { SubscriptionsView } from './components/subscriptions/SubscriptionsView';
import { LedgerTimeline } from './components/history/LedgerTimeline';
import { SettingsView } from './components/settings/SettingsView';

// Recharts (net worth + trends) is the bulk of the JS bundle — split it into its own
// chunk so the other six tabs don't pay for it on first load.
const NetWorthView = lazy(() => import('./components/networth/NetWorthView').then((m) => ({ default: m.NetWorthView })));
const TrendsView = lazy(() => import('./components/trends/TrendsView').then((m) => ({ default: m.TrendsView })));

function ChartTabFallback() {
  return <div className="py-16 text-center text-sm text-neutral-400">Loading…</div>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const ensureDefaultBuckets = useStore((s) => s.ensureDefaultBuckets);
  const runSubscriptionSimulation = useStore((s) => s.runSubscriptionSimulation);

  useEffect(() => {
    ensureDefaultBuckets();
    runSubscriptionSimulation();
  }, [ensureDefaultBuckets, runSubscriptionSimulation]);

  return (
    <AppShell active={tab} onChange={setTab}>
      {tab === 'home' && <Dashboard />}
      {tab === 'buckets' && <BucketsView />}
      {tab === 'expenses' && <ExpensesView />}
      {tab === 'subscriptions' && <SubscriptionsView />}
      {tab === 'networth' && (
        <Suspense fallback={<ChartTabFallback />}>
          <NetWorthView />
        </Suspense>
      )}
      {tab === 'trends' && (
        <Suspense fallback={<ChartTabFallback />}>
          <TrendsView />
        </Suspense>
      )}
      {tab === 'history' && <LedgerTimeline />}
      {tab === 'settings' && <SettingsView />}
    </AppShell>
  );
}
