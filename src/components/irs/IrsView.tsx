import { Reveal } from '../ui/Reveal';
import { IrsPanel } from './IrsPanel';

/**
 * IRS deductions, on their own tab.
 *
 * Used to live at the bottom of Plan, under Goals and Debt — reachable only by
 * scrolling past two unrelated cards. It shares no state with either of them,
 * so splitting it out cost nothing and means the one evening a year you're
 * actually filing is a single click, not a scroll.
 */
export function IrsView() {
  return (
    <Reveal className="space-y-3" from="start">
      <IrsPanel />
    </Reveal>
  );
}
