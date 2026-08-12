import { Reveal } from '../ui/Reveal';
import { RecurringManager } from './RecurringManager';
import { ExpenseEntryForm } from './ExpenseEntryForm';
import { BudgetManager } from './BudgetManager';
import { CategoryManager } from './CategoryManager';
import { Subscriptions } from './Subscriptions';
import { History } from './History';

/**
 * Every input in the app lives here, so Overview stays purely a read surface.
 * Income leads: it is the number everything else is measured against.
 */
export function EntriesView() {
  return (
    <Reveal className="grid grid-cols-1 gap-3 xl:grid-cols-2" from="start">
      <div className="space-y-3">
        <RecurringManager kind="income" />
        <ExpenseEntryForm />
        <RecurringManager kind="expense" />
        <BudgetManager />
        <Subscriptions />
        <CategoryManager />
      </div>
      <History />
    </Reveal>
  );
}
