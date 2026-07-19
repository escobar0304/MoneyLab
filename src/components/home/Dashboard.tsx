import { useMemo } from 'react';
import { useStore } from '../../lib/store';
import { totalBalance } from '../../lib/derive';
import { Card } from '../ui/primitives';
import { formatMoney } from '../../lib/format';
import { SalaryForm } from './SalaryForm';
import { ExtraIncomeForm } from './ExtraIncomeForm';
import { NetWorthChart } from './NetWorthChart';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { SpendByCategoryPie } from './SpendByCategoryPie';
import { SpentVsRemainingPie } from './SpentVsRemainingPie';

export function Dashboard() {
  const events = useStore((s) => s.events);
  const balance = useMemo(() => totalBalance(events), [events]);

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs font-medium text-neutral-500">Balance</p>
        <p className="mt-1 text-4xl font-semibold text-neutral-100">{formatMoney(balance)}</p>
        <p className="mt-1 text-xs text-neutral-500">Everything you've earned, minus everything you've spent.</p>
      </Card>

      <SalaryForm />
      <ExtraIncomeForm />

      <Card>
        <p className="mb-3 text-sm font-semibold text-neutral-100">Net worth over time</p>
        <NetWorthChart />
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-neutral-100">Income vs. expenses</p>
        <IncomeVsExpensesChart />
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-neutral-100">Spend by category</p>
        <SpendByCategoryChart />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm font-semibold text-neutral-100">Spend by category (this month)</p>
          <SpendByCategoryPie />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-neutral-100">Spent vs. remaining</p>
          <SpentVsRemainingPie />
        </Card>
      </div>
    </div>
  );
}
