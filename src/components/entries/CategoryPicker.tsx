import { useMemo, useState } from 'react';
import { useStore, useCategories } from '../../lib/core/store';
import { categoryColorMap } from '../../lib/insight/chartTheme';
import { Button, Input, Label } from '../ui/primitives';

/**
 * Categories as reusable tags rather than a free-text field.
 *
 * Typing the name every time is how "Groceries", "groceries" and "Grocery" end
 * up as three different series in the charts. Picking from a fixed set makes the
 * category dimension stable, which every chart downstream depends on — so the
 * only way to introduce a new one is deliberately, through "New".
 *
 * Deliberately not applied to subcategory or note: those are free-form detail,
 * and forcing them into a controlled vocabulary would just add friction.
 */
export function CategoryPicker({
  value,
  onChange,
  id = 'expense-category',
}: {
  value: string;
  onChange: (name: string) => void;
  id?: string;
}) {
  const categories = useCategories();
  const events = useStore((s) => s.events);
  const addCategory = useStore((s) => s.addCategory);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  const duplicate = categories.some((c) => c.toLowerCase() === draft.trim().toLowerCase());

  const create = () => {
    const name = draft.trim();
    if (!name || duplicate) return;
    addCategory(name);
    onChange(name);
    setDraft('');
    setCreating(false);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label htmlFor={id}>Category</Label>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="cursor-pointer text-xs font-medium text-accent hover:text-accent-hover"
        >
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {creating && (
        <div className="mb-2 flex gap-2">
          <Input
            id={`${id}-new`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              }
            }}
            placeholder="New category name"
            aria-label="New category name"
            autoFocus
          />
          <Button onClick={create} disabled={!draft.trim() || duplicate}>
            Add
          </Button>
        </div>
      )}
      {creating && duplicate && <p className="mb-2 text-xs text-complement">“{draft.trim()}” already exists.</p>}

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-ink-muted">
          No categories yet — create one with “+ New”.
        </p>
      ) : (
        <div id={id} role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
          {categories.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(selected ? '' : name)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  selected ? 'border-accent/50 bg-accent/12 text-ink' : 'border-hairline text-ink-secondary hover:border-border hover:text-ink'
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(name) ?? 'var(--color-ink-muted)' }} />
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
