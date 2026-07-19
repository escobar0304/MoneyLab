export type Tab = 'home' | 'buckets' | 'expenses' | 'subscriptions' | 'networth' | 'history' | 'trends' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'buckets', label: 'Buckets' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'networth', label: 'Net Worth' },
  { id: 'trends', label: 'Trends' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export function TabNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 sm:px-4 no-scrollbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 whitespace-nowrap rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors ${
            active === tab.id
              ? 'text-neutral-900 border-b-2 border-neutral-900'
              : 'text-neutral-500 border-b-2 border-transparent hover:text-neutral-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
