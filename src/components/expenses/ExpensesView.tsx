import { ExpenseEntryForm } from './ExpenseEntryForm';
import { MonthlySummary } from './MonthlySummary';

export function ExpensesView() {
  return (
    <div className="space-y-6">
      <ExpenseEntryForm />
      <MonthlySummary />
    </div>
  );
}
