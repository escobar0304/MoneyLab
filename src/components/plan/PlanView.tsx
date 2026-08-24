import { Reveal } from '../ui/Reveal';
import { GoalsManager } from './GoalsManager';
import { DebtManager } from './DebtManager';

/**
 * The forward-looking page: what you are saving towards, and what you owe.
 *
 * Kept apart from Entries because nothing here is a transaction. A goal and a
 * loan are standing facts that shape every month, not events that happened in
 * one — and mixing them into the logging page would bury the one thing that
 * page has to do quickly.
 */
export function PlanView() {
  return (
    <Reveal className="space-y-3" from="start">
      <GoalsManager />
      <DebtManager />
    </Reveal>
  );
}
