import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/TabNav';
import { useStore } from './lib/store';
import { Dashboard } from './components/home/Dashboard';
import { BucketsView } from './components/buckets/BucketsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { SubscriptionsView } from './components/subscriptions/SubscriptionsView';
import { NetWorthView } from './components/networth/NetWorthView';
import { LedgerTimeline } from './components/history/LedgerTimeline';
import { TrendsView } from './components/trends/TrendsView';
import { SettingsView } from './components/settings/SettingsView';

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
      {tab === 'networth' && <NetWorthView />}
      {tab === 'trends' && <TrendsView />}
      {tab === 'history' && <LedgerTimeline />}
      {tab === 'settings' && <SettingsView />}
    </AppShell>
  );
}
