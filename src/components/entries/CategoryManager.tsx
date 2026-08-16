import { useMemo, useState } from 'react';
import { useStore, useCategories, useBudgets } from '../../lib/store';
import { categoryColorMap } from '../../lib/chartTheme';
import { formatMoney } from '../../lib/format';
import { Button, Card, Input, SectionTitle, Modal, EmptyState } from '../ui/primitives';

/** Case- and accent-folded, so "Alimentação" and "alimentacao" collide. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Renaming and merging categories.
 *
 * Categories were create-and-delete only, which meant a typo was permanent and
 * two names for the same thing could only be reconciled by editing every entry
 * by hand. Since every chart groups by this dimension, a split category quietly
 * halves both of its bars — so this is data hygiene, not tidying.
 */
export function CategoryManager() {
  const events = useStore((s) => s.events);
  const categories = useCategories();
  const budgets = useBudgets();
  const rename = useStore((s) => s.renameCategory);
  const remove = useStore((s) => s.removeCategory);
  const colors = useMemo(() => categoryColorMap(events), [events]);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmMerge, setConfirmMerge] = useState<{ from: string; to: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.type === 'expense') counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  // Names that differ only by case or accent are almost always the same thing
  // typed twice, so they get pointed out rather than left to be noticed in a
  // chart six months later.
  const collisions = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const name of categories) {
      const key = fold(name);
      seen.set(key, [...(seen.get(key) ?? []), name]);
    }
    return new Set(
      Array.from(seen.values())
        .filter((names) => names.length > 1)
        .flat()
    );
  }, [categories]);

  const start = (name: string) => {
    setEditing(name);
    setDraft(name);
  };

  const commit = (from: string) => {
    const to = draft.trim();
    if (!to || to === from) {
      setEditing(null);
      return;
    }
    // Landing on an existing name is a merge, and merges are not reversible by
    // renaming back — so it gets confirmed with what it will actually do.
    const target = categories.find((c) => c.toLowerCase() === to.toLowerCase() && c !== from);
    if (target) {
      setConfirmMerge({ from, to: target });
      return;
    }
    rename(from, to);
    setEditing(null);
  };

  return (
    <Card>
      <SectionTitle>Categories</SectionTitle>

      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="They appear here as soon as you create one in the expense form." />
      ) : (
        <ul className="space-y-1">
          {categories.map((name) => {
            const count = usage.get(name) ?? 0;
            const limit = budgets.get(name);
            return (
              <li key={name} className="group flex items-center gap-2 rounded-md px-1 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(name) ?? 'var(--color-ink-muted)' }} />

                {editing === name ? (
                  <>
                    <span className="min-w-0 flex-1">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commit(name);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        aria-label={`Rename ${name}`}
                        autoFocus
                      />
                    </span>
                    <Button onClick={() => commit(name)}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="truncate text-sm text-ink-secondary">{name}</span>
                      <span className={`ml-2 text-xs text-ink-muted${limit !== undefined ? ' money' : ''}`}>
                        {count} {count === 1 ? 'entry' : 'entries'}
                        {limit !== undefined && ` · ${formatMoney(limit)}/month`}
                      </span>
                      {collisions.has(name) && (
                        <span className="ml-2 text-xs text-complement">looks like a duplicate</span>
                      )}
                    </span>
                    <Button variant="ghost" onClick={() => start(name)} aria-label={`Rename ${name}`}>
                      Rename
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmRemove(name)} aria-label={`Remove ${name}`}>
                      Remove
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Renaming updates every entry, recurring rule and budget at once. Rename one onto another to merge them.
      </p>

      {confirmMerge && (
        <Modal title={`Merge into “${confirmMerge.to}”?`} onClose={() => setConfirmMerge(null)}>
          <p className="text-sm text-ink-secondary">
            All <strong>{usage.get(confirmMerge.from) ?? 0}</strong> entries in{' '}
            <strong className="text-ink">{confirmMerge.from}</strong> move to{' '}
            <strong className="text-ink">{confirmMerge.to}</strong>, and “{confirmMerge.from}” disappears.
          </p>
          {budgets.has(confirmMerge.from) && (
            <p className="mt-2 text-sm text-ink-muted">
              Its budget of <span className="num-col">{formatMoney(budgets.get(confirmMerge.from) as number)}</span> is dropped —{' '}
              {confirmMerge.to} keeps its own.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-muted">Undo puts it back, until you leave the page.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmMerge(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                rename(confirmMerge.from, confirmMerge.to);
                setConfirmMerge(null);
                setEditing(null);
              }}
            >
              Merge
            </Button>
          </div>
        </Modal>
      )}

      {confirmRemove && (
        <Modal title={`Remove “${confirmRemove}”?`} onClose={() => setConfirmRemove(null)}>
          <p className="text-sm text-ink-secondary">
            It disappears from the picker and takes its budget with it.{' '}
            {(usage.get(confirmRemove) ?? 0) > 0 && (
              <>
                The <strong>{usage.get(confirmRemove)}</strong> entries already filed under it keep their category and will bring
                the name back — rename it onto another category instead if you meant to merge.
              </>
            )}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                remove(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              Remove
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
