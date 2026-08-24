import { useState } from 'react';
import { Reveal } from '../ui/Reveal';
import { Segmented } from '../ui/Segmented';
import { RecurringManager } from './RecurringManager';
import { ExpenseEntryForm } from './ExpenseEntryForm';
import { AccountsManager } from './AccountsManager';
import { RulesManager } from './RulesManager';
import { StatementImport } from './StatementImport';
import { BudgetManager } from './BudgetManager';
import { CategoryManager } from './CategoryManager';
import { Subscriptions } from './Subscriptions';
import { History } from './History';

type Section = 'log' | 'manage';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'manage', label: 'Manage' },
];

/**
 * Every input in the app lives here, so Overview stays purely a read surface.
 *
 * The left column used to be nine panels stacked in one scroll, with no line
 * between "money moving today" and "how the books are set up" — logging an
 * expense and merging two mistyped categories were the same kind of thing to
 * the page, even though one happens daily and the other happens once. Log
 * groups what actually posts an entry (income leads: it's the number
 * everything else is measured against); Manage groups the setup you visit
 * occasionally to keep Log honest. History stays put regardless — it's useful
 * context whichever you're doing.
 */
export function EntriesView() {
  const [section, setSection] = useState<Section>('log');

  return (
    <Reveal className="grid grid-cols-1 gap-3 xl:grid-cols-2" from="start">
      <div className="space-y-3">
        <Segmented options={SECTIONS} value={section} onChange={setSection} label="Entries section" />

        <Reveal key={section} className="space-y-3" from="start">
          {section === 'log' ? (
            <>
              <RecurringManager kind="income" />
              <ExpenseEntryForm />
              <RecurringManager kind="expense" />
            </>
          ) : (
            <>
              <StatementImport />
              <AccountsManager />
              <BudgetManager />
              <Subscriptions />
              <RulesManager />
              <CategoryManager />
            </>
          )}
        </Reveal>
      </div>
      <History />
    </Reveal>
  );
}
