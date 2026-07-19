import { BalanceGrid } from './BalanceGrid';
import { IncomeEntryForm } from './IncomeEntryForm';
import { UpcomingRenewals } from './UpcomingRenewals';
import { ThisMonthSummary } from './ThisMonthSummary';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <BalanceGrid />
      <IncomeEntryForm />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingRenewals />
        <ThisMonthSummary />
      </div>
    </div>
  );
}
