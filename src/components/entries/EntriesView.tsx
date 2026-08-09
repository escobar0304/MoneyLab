import { Reveal } from '../ui/Reveal';
import { Card } from '../ui/primitives';
import { SalaryForm } from './SalaryForm';
import { ExtraIncomeForm } from './ExtraIncomeForm';
import { ExpenseEntryForm } from './ExpenseEntryForm';
import { RecentEntries } from './RecentEntries';

/**
 * Every input in the app lives here. Overview stays purely a read surface, so
 * neither page has to compromise: forms get room to breathe and the dashboard
 * never interrupts a scan with a text field.
 */
export function EntriesView() {
  return (
    <Reveal className="grid grid-cols-1 gap-3 xl:grid-cols-2" from="start">
      <div className="space-y-3">
        <ExpenseEntryForm />
        <SalaryForm />
        <Card>
          <p className="mb-3 text-sm font-semibold text-ink">One-off income</p>
          <ExtraIncomeForm />
        </Card>
      </div>
      <RecentEntries />
    </Reveal>
  );
}
