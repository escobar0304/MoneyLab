import { useState } from 'react';
import { useStore, useRecurring } from '../../lib/store';
import { Button, Card, Input, Label, SectionTitle } from '../ui/primitives';
import { formatMoney, formatDate, todayInputValue } from '../../lib/format';
import { nextRenewalDate } from '../../lib/recurrence';
import type { Recurring, RecurringKind } from '../../lib/types';
import { CategoryPicker } from './CategoryPicker';

interface Draft {
  label: string;
  amount: string;
  startDate: string;
  category: string;
}

const emptyDraft = (): Draft => ({ label: '', amount: '', startDate: todayInputValue(), category: '' });

const COPY: Record<RecurringKind, { title: string; add: string; unit: string; empty: string; namePlaceholder: string; verb: string }> = {
  income: {
    title: 'Income',
    add: 'Add source',
    unit: 'expected each month',
    empty: 'No recurring income yet. Add a salary, a retainer, anything that arrives every month.',
    namePlaceholder: 'Monthly salary',
    verb: 'Adds',
  },
  expense: {
    title: 'Recurring expenses',
    add: 'Add expense',
    unit: 'committed each month',
    empty: 'No recurring expenses yet. Add rent, a subscription, anything that leaves every month.',
    namePlaceholder: 'Rent',
    verb: 'Charges',
  },
};

function RuleRow({ rule }: { rule: Recurring }) {
  const upsert = useStore((s) => s.upsertRecurring);
  const remove = useStore((s) => s.removeRecurring);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    label: rule.label,
    amount: String(rule.amount),
    startDate: rule.startDate.slice(0, 10),
    category: rule.category ?? '',
  });

  const copy = COPY[rule.kind];
  const needsCategory = rule.kind === 'expense';
  const valid = draft.label.trim() !== '' && (Number(draft.amount) || 0) > 0 && (!needsCategory || draft.category.trim() !== '');

  const save = () => {
    if (!valid) return;
    upsert({
      id: rule.id,
      kind: rule.kind,
      label: draft.label.trim(),
      amount: Number(draft.amount),
      startDate: new Date(draft.startDate).toISOString(),
      category: needsCategory ? draft.category.trim() : undefined,
      active: rule.active,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-surface-0 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`r-label-${rule.id}`}>Name</Label>
            <Input id={`r-label-${rule.id}`} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={`r-amount-${rule.id}`}>Amount / month</Label>
            <Input
              id={`r-amount-${rule.id}`}
              type="number"
              min={0}
              step={0.01}
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`r-start-${rule.id}`}>Starting</Label>
            <Input
              id={`r-start-${rule.id}`}
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </div>
        </div>
        {needsCategory && (
          <div className="mt-3">
            <CategoryPicker value={draft.category} onChange={(c) => setDraft({ ...draft, category: c })} id={`r-cat-${rule.id}`} />
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  const next = rule.active ? nextRenewalDate(rule) : null;

  return (
    <div className={`rounded-lg border border-hairline p-3 transition-opacity ${rule.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{rule.label}</p>
            {rule.category && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">{rule.category}</span>}
            {!rule.active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted">Paused</span>}
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            {/* States what it will actually do, rather than leaving the user to
                infer it from a start date. */}
            {rule.active ? (
              <>
                {copy.verb} <span className="num-col text-ink-secondary">{formatMoney(rule.amount)}</span> monthly · next on{' '}
                {next ? formatDate(next.toISOString()) : '—'}
              </>
            ) : (
              <>
                <span className="num-col">{formatMoney(rule.amount)}</span> monthly · nothing posted while paused
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" onClick={() => upsert({ ...rule, active: !rule.active })}>
            {rule.active ? 'Pause' : 'Resume'}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => remove(rule.id)} aria-label={`Remove ${rule.label}`}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One manager for both directions of recurrence.
 *
 * Rent and salary are the same problem — a fixed amount that posts every month
 * and occasionally needs pausing or skipping — so they share a component as well
 * as a data type, and neither can grow a behaviour the other silently lacks.
 */
export function RecurringManager({ kind }: { kind: RecurringKind }) {
  const rules = useRecurring(kind);
  const upsert = useStore((s) => s.upsertRecurring);
  const addIncome = useStore((s) => s.addIncome);
  const copy = COPY[kind];

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [oneOff, setOneOff] = useState({ amount: '', label: '', date: todayInputValue() });
  const [oneOffOpen, setOneOffOpen] = useState(false);

  const monthlyTotal = rules.filter((r) => r.active).reduce((sum, r) => sum + r.amount, 0);
  const needsCategory = kind === 'expense';
  const valid = draft.label.trim() !== '' && (Number(draft.amount) || 0) > 0 && (!needsCategory || draft.category.trim() !== '');

  const create = () => {
    if (!valid) return;
    upsert({
      kind,
      label: draft.label.trim(),
      amount: Number(draft.amount),
      startDate: new Date(draft.startDate).toISOString(),
      category: needsCategory ? draft.category.trim() : undefined,
      active: true,
    });
    setDraft(emptyDraft());
    setAdding(false);
  };

  const logOneOff = () => {
    const amount = Number(oneOff.amount) || 0;
    if (amount <= 0 || !oneOff.label.trim()) return;
    addIncome({ amount, label: oneOff.label.trim(), date: new Date(oneOff.date).toISOString() });
    setOneOff({ amount: '', label: '', date: todayInputValue() });
    setOneOffOpen(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : `+ ${copy.add}`}</Button>}>
        {copy.title}
      </SectionTitle>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-ink">{formatMoney(monthlyTotal)}</span>
        <span className="text-xs text-ink-muted">
          {copy.unit}
          {rules.length > 0 && ` · ${rules.filter((r) => r.active).length} active`}
        </span>
      </div>

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`new-${kind}-label`}>Name</Label>
              <Input
                id={`new-${kind}-label`}
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder={copy.namePlaceholder}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor={`new-${kind}-amount`}>Amount / month</Label>
              <Input
                id={`new-${kind}-amount`}
                type="number"
                min={0}
                step={0.01}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="900"
              />
            </div>
            <div>
              <Label htmlFor={`new-${kind}-start`}>Starting</Label>
              <Input
                id={`new-${kind}-start`}
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
          </div>
          {needsCategory && (
            <div className="mt-3">
              <CategoryPicker value={draft.category} onChange={(c) => setDraft({ ...draft, category: c })} id={`new-${kind}-cat`} />
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <Button onClick={create} disabled={!valid}>
              {copy.add}
            </Button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">{copy.empty}</p>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} />
          ))}
        </div>
      )}

      {kind === 'income' && (
        <div className="mt-4 border-t border-hairline pt-3">
          {oneOffOpen ? (
            <div className="rounded-lg border border-border bg-surface-0 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="oneoff-amount">Amount</Label>
                  <Input
                    id="oneoff-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    value={oneOff.amount}
                    onChange={(e) => setOneOff({ ...oneOff, amount: e.target.value })}
                    placeholder="200"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="oneoff-label">What was it</Label>
                  <Input
                    id="oneoff-label"
                    value={oneOff.label}
                    onChange={(e) => setOneOff({ ...oneOff, label: e.target.value })}
                    placeholder="Birthday gift"
                  />
                </div>
                <div>
                  <Label htmlFor="oneoff-date">Date</Label>
                  <Input id="oneoff-date" type="date" value={oneOff.date} onChange={(e) => setOneOff({ ...oneOff, date: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOneOffOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={logOneOff} disabled={(Number(oneOff.amount) || 0) <= 0 || !oneOff.label.trim()}>
                  Log it
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOneOffOpen(true)}
              className="cursor-pointer text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              + Log one-off income
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
