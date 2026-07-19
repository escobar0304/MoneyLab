import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import type { Tab } from './components/layout/TabNav';
import { useStore } from './lib/store';
import { Dashboard } from './components/home/Dashboard';
import { ExpensesView } from './components/expenses/ExpensesView';
import { SettingsView } from './components/settings/SettingsView';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const runSalarySimulation = useStore((s) => s.runSalarySimulation);

  useEffect(() => {
    runSalarySimulation();
  }, [runSalarySimulation]);

  return (
    <AppShell active={tab} onChange={setTab}>
      {tab === 'home' && <Dashboard />}
      {tab === 'expenses' && <ExpensesView />}
      {tab === 'settings' && <SettingsView />}
    </AppShell>
  );
}
