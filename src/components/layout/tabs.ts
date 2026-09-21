import {
  IconOverview,
  IconEntries,
  IconPlan,
  IconIrs,
  IconTaxes,
  IconPortfolio,
  IconMarkets,
  IconSettings,
} from '../ui/icons';

export type Tab = 'overview' | 'entries' | 'plan' | 'irs' | 'taxes' | 'portfolio' | 'markets' | 'settings';

export type TabDef = { id: Tab; label: string; Icon: typeof IconOverview };

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', Icon: IconOverview },
  { id: 'entries', label: 'Entries', Icon: IconEntries },
  { id: 'plan', label: 'Plan', Icon: IconPlan },
  { id: 'irs', label: 'IRS', Icon: IconIrs },
  { id: 'taxes', label: 'Taxes', Icon: IconTaxes },
  { id: 'portfolio', label: 'Portfolio', Icon: IconPortfolio },
  { id: 'markets', label: 'Markets', Icon: IconMarkets },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

/**
 * The four that earn a permanent slot on a phone's tab bar, and the order they
 * sit in.
 *
 * Five slots is the practical ceiling for a thumb-sized bar, and the fifth is
 * spent on the way to everything else — so this is a choice about what you
 * reach for without thinking. Overview and Entries are the loop the app exists
 * for: look at where you stand, write down what happened. Plan is where you go
 * when the answer to that was not the one you wanted. Portfolio moves on its
 * own and is worth checking without an errand.
 *
 * What is behind More is not lesser, it is *seasonal* or *set once*: IRS and
 * Taxes matter intensely for a few weeks a year, Markets is reading rather than
 * bookkeeping, and Settings is a place you visit twice.
 */
export const PRIMARY_TABS: Tab[] = ['overview', 'entries', 'plan', 'portfolio'];

export const SECONDARY_TABS: Tab[] = TABS.map((t) => t.id).filter((id) => !PRIMARY_TABS.includes(id));

export function tabDef(id: Tab): TabDef {
  // Every caller passes an id from TABS itself, so a miss is a programming
  // error rather than a state the UI should try to render around.
  const found = TABS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown tab: ${id}`);
  return found;
}
