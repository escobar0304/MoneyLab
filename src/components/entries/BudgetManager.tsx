import { useMemo, useState } from 'react';
import { useStore, useBudgets, useCategories } from '../../lib/core/store';
import { categoryColorMap } from '../../lib/insight/chartTheme';
import { formatMoney } from '../../lib/core/format';
import { Button, Card, Input, SectionTitle } from '../ui/primitives';

/**
 * Monthly limits per category.
 *
 * Limits live on categories rather than on the month, so they carry forward on
 * their own — a budget you have to re-enter every month is a budget you stop
 * keeping by February.
 */
export function BudgetManager() {
  const events = useStore((s) => s.events);
  const categories = useCategories();
  const budgets = useBudgets();
  const setBudget = useStore((s) => s.setBudget);
  const clearBudget = useStore((s) => s.clearBudget);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const totalBudgeted = Array.from(budgets.values()).reduce((sum, v) => sum + v, 0);

  const commit = (category: string) => {
    const raw = drafts[category];
    if (raw === undefined) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) clearBudget(category);
    else setBudget(category, amount);
    setDrafts((d) => {
      const next = { ...d };
      delete next[category];
      return next;
    });
  };

  return (
    <Card>
      <SectionTitle>Budgets</SectionTitle>

      {categories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">
          Create a category first — budgets are set per category.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-muted">
            <span className="num-col text-ink-secondary">{formatMoney(totalBudgeted)}</span> budgeted across{' '}
            {budgets.size} of {categories.length} categories. Leave blank for no limit.
          </p>
          <ul className="space-y-1.5">
            {categories.map((category) => {
              const current = budgets.get(category);
              const value = drafts[category] ?? (current !== undefined ? String(current) : '');
              return (
                <li key={category} className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(category) ?? 'var(--color-ink-muted)' }} />
                    <span className="truncate text-sm text-ink-secondary">{category}</span>
                  </span>
                  <div className="w-28 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Monthly budget for ${category}`}
                    placeholder="No limit"
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [category]: e.target.value }))}
                    onBlur={() => commit(category)}
                    onKeyDown={(e) => e.key === 'Enter' && commit(category)}
                  />
                  </div>
                  {current !== undefined && (
                    <Button variant="ghost" onClick={() => clearBudget(category)} aria-label={`Clear budget for ${category}`}>
                      ✕
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
