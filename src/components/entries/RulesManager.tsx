import { useMemo, useState } from 'react';
import { useStore, useRules, useAccounts } from '../../lib/store';
import { MAIN_ACCOUNT_ID } from '../../lib/accounts';
import { matchCount, ruleChanges } from '../../lib/rules';
import { Button, Card, Input, Label, Modal, SectionTitle, Select, EmptyState } from '../ui/primitives';
import { CategoryPicker } from './CategoryPicker';
import type { ID, Rule, RuleCondition, RuleField, RuleOp } from '../../lib/types';

const FIELDS: { id: RuleField; label: string }[] = [
  { id: 'text', label: 'Category, note or source' },
  { id: 'category', label: 'Category' },
  { id: 'amount', label: 'Amount' },
];

const OPS: Record<RuleField, { id: RuleOp; label: string }[]> = {
  text: [
    { id: 'contains', label: 'contains' },
    { id: 'equals', label: 'is exactly' },
  ],
  category: [
    { id: 'equals', label: 'is' },
    { id: 'contains', label: 'contains' },
  ],
  amount: [
    { id: 'gte', label: 'is at least' },
    { id: 'lte', label: 'is at most' },
    { id: 'equals', label: 'is exactly' },
  ],
};

const emptyCondition = (): RuleCondition => ({ field: 'text', op: 'contains', value: '' });

const blank = (): Omit<Rule, 'id'> => ({
  label: '',
  active: true,
  appliesTo: 'expense',
  conditions: [emptyCondition()],
  actions: {},
});

/** Reads a rule back as the sentence it is, so the list can be scanned without
 * opening each one. */
function describe(rule: Rule, accountName: (id: ID) => string): string {
  const when = rule.conditions
    .map((c) => {
      const field = FIELDS.find((f) => f.id === c.field)?.label ?? c.field;
      const op = OPS[c.field].find((o) => o.id === c.op)?.label ?? c.op;
      return `${field.toLowerCase()} ${op} “${c.value}”`;
    })
    .join(' and ');

  const then = [
    rule.actions.category && `file under ${rule.actions.category}`,
    rule.actions.subcategory && `tag as ${rule.actions.subcategory}`,
    rule.actions.accountId && `put in ${accountName(rule.actions.accountId)}`,
  ]
    .filter(Boolean)
    .join(', ');

  return `When ${when} → ${then || 'do nothing yet'}`;
}

/**
 * "When an entry looks like this, file it like that."
 *
 * One primitive instead of a setting per destination. The reason it earns its
 * place is that the pattern is always noticed *after* the entries exist — so
 * the retroactive pass matters more than the automatic one, and it shows what
 * it would change before it changes anything.
 */
export function RulesManager() {
  const events = useStore((s) => s.events);
  const rules = useRules();
  const accounts = useAccounts();
  const upsertRule = useStore((s) => s.upsertRule);
  const removeRule = useStore((s) => s.removeRule);
  const applyRulesToExisting = useStore((s) => s.applyRulesToExisting);

  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  const accountName = (id: ID) => accounts.find((a) => a.id === id)?.label ?? 'a closed account';
  const pending = useMemo(() => ruleChanges(events, rules, accountName), [events, rules, accounts]);

  return (
    <Card>
      <SectionTitle action={<Button variant="secondary" onClick={() => setCreating(true)}>New rule</Button>}>Rules</SectionTitle>

      {rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="A rule files entries for you — “note contains Lidl → Groceries”, or “note contains Trading 212 → the Investments account”."
        />
      ) : (
        <>
          <ul className="divide-y divide-hairline">
            {rules.map((rule) => (
              <li key={rule.id} className="row-pad flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-sm ${rule.active ? 'text-ink' : 'text-ink-muted line-through'}`}>{rule.label}</span>
                    <span className="t-caption shrink-0">{matchCount(events, { ...rule, active: true })} matching</span>
                  </span>
                  <span className="t-caption mt-0.5 block">{describe(rule, accountName)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <label className="flex cursor-pointer items-center gap-1.5 pr-1 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) => upsertRule({ ...rule, active: e.target.checked })}
                      className="h-4 w-4 cursor-pointer accent-accent"
                      aria-label={`${rule.label} active`}
                    />
                    On
                  </label>
                  <Button variant="ghost" onClick={() => setEditing(rule)} aria-label={`Edit ${rule.label}`}>
                    Edit
                  </Button>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
            <p className="t-caption">
              {/* Said plainly, because it is the one thing about rules that is
                  easy to assume wrongly. */}
              Rules run on entries you log from here. Recurring postings already say where they go, so they are left alone.
            </p>
            {pending.length > 0 ? (
              <Button variant="secondary" onClick={() => setReviewing(true)}>
                Apply to {pending.length} older {pending.length === 1 ? 'entry' : 'entries'}
              </Button>
            ) : (
              <p className="t-caption">Nothing older left to refile.</p>
            )}
          </div>
          {applied !== null && (
            <p role="status" className="mt-2 text-xs text-positive">
              {applied} {applied === 1 ? 'entry' : 'entries'} refiled. Undo is available from the toast.
            </p>
          )}
        </>
      )}

      {(creating || editing) && (
        <RuleForm
          rule={editing ?? undefined}
          accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
          matches={(draft) => matchCount(events, { ...draft, id: editing?.id ?? 'draft', active: true })}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(draft) => upsertRule(editing ? { ...draft, id: editing.id } : draft)}
          onDelete={editing ? () => removeRule(editing.id) : undefined}
        />
      )}

      {reviewing && (
        <Modal title="Apply rules to older entries" width="lg" onClose={() => setReviewing(false)}>
          <p className="text-sm text-ink-secondary">
            These {pending.length} {pending.length === 1 ? 'entry is' : 'entries are'} filed differently from what the rules say. Anything
            you categorised by hand that no rule matches is left alone.
          </p>
          <ul className="mt-3 max-h-[45vh] divide-y divide-hairline overflow-y-auto">
            {pending.slice(0, 200).map((change) => (
              <li key={change.entry.id} className="row-pad text-xs">
                <p className="text-ink-secondary">
                  {change.entry.type === 'income' ? change.entry.label : change.entry.category} ·{' '}
                  <span className="num-col">{change.entry.amount.toFixed(2)}</span> · {change.entry.timestamp.slice(0, 10)}
                </p>
                <p className="mt-0.5 text-ink-muted">{change.changes.join(' · ')}</p>
              </li>
            ))}
          </ul>
          {pending.length > 200 && <p className="t-caption mt-2">…and {pending.length - 200} more.</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReviewing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setApplied(applyRulesToExisting());
                setReviewing(false);
              }}
            >
              Apply them
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function RuleForm({
  rule,
  accounts,
  matches,
  onClose,
  onSave,
  onDelete,
}: {
  rule?: Rule;
  accounts: { id: ID; label: string }[];
  matches: (draft: Omit<Rule, 'id'>) => number;
  onClose: () => void;
  onSave: (draft: Omit<Rule, 'id'>) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Omit<Rule, 'id'>>(() => (rule ? { ...rule, conditions: rule.conditions.map((c) => ({ ...c })) } : blank()));

  const set = (patch: Partial<Omit<Rule, 'id'>>) => setDraft((d) => ({ ...d, ...patch }));
  const setCondition = (i: number, patch: Partial<RuleCondition>) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const usable = draft.label.trim() !== '' && draft.conditions.some((c) => c.value.trim() !== '');
  const hasAction = Boolean(draft.actions.category || draft.actions.subcategory || draft.actions.accountId);
  // Shown live: a rule's reach is the one thing worth knowing before saving it.
  const reach = usable ? matches(draft) : 0;

  return (
    <Modal title={rule ? `Edit “${rule.label}”` : 'New rule'} width="lg" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rule-label">Name</Label>
            <Input id="rule-label" value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Supermarkets" autoFocus />
          </div>
          <div>
            <Label htmlFor="rule-applies">Applies to</Label>
            <Select id="rule-applies" value={draft.appliesTo} onChange={(e) => set({ appliesTo: e.target.value as Rule['appliesTo'] })}>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="any">Both</option>
            </Select>
          </div>
        </div>

        <div>
          <p className="t-label mb-2">When all of these are true</p>
          <div className="space-y-2">
            {draft.conditions.map((condition, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                <Select
                  value={condition.field}
                  aria-label={`Condition ${i + 1} field`}
                  onChange={(e) => {
                    const field = e.target.value as RuleField;
                    // The operators differ per field, so keep the pair valid
                    // instead of leaving "amount contains".
                    setCondition(i, { field, op: OPS[field][0].id });
                  }}
                >
                  {FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={condition.op}
                  aria-label={`Condition ${i + 1} test`}
                  onChange={(e) => setCondition(i, { op: e.target.value as RuleOp })}
                >
                  {OPS[condition.field].map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={condition.value}
                  aria-label={`Condition ${i + 1} value`}
                  onChange={(e) => setCondition(i, { value: e.target.value })}
                  inputMode={condition.field === 'amount' ? 'decimal' : undefined}
                  placeholder={condition.field === 'amount' ? '50' : 'Lidl'}
                />
                <Button
                  variant="ghost"
                  aria-label={`Remove condition ${i + 1}`}
                  disabled={draft.conditions.length === 1}
                  onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, emptyCondition()] }))}>
              Add condition
            </Button>
          </div>
        </div>

        <div>
          <p className="t-label mb-2">Then</p>
          <div className="space-y-3">
            {draft.appliesTo !== 'income' && (
              <>
                <CategoryPicker
                  id="rule-category"
                  value={draft.actions.category ?? ''}
                  onChange={(category) => set({ actions: { ...draft.actions, category: category || undefined } })}
                />
                <div>
                  <Label htmlFor="rule-subcategory">Subcategory (optional)</Label>
                  <Input
                    id="rule-subcategory"
                    value={draft.actions.subcategory ?? ''}
                    onChange={(e) => set({ actions: { ...draft.actions, subcategory: e.target.value || undefined } })}
                    placeholder="Weekly shop"
                  />
                </div>
              </>
            )}
            {accounts.length > 1 && (
              <div>
                <Label htmlFor="rule-account">Account</Label>
                <Select
                  id="rule-account"
                  value={draft.actions.accountId ?? ''}
                  onChange={(e) => set({ actions: { ...draft.actions, accountId: e.target.value || undefined } })}
                >
                  <option value="">Leave it where it lands</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id === MAIN_ACCOUNT_ID ? `${a.label} (default)` : a.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
          <p className="t-caption">
            {!usable
              ? 'Name it and give it something to match.'
              : !hasAction
                ? 'Pick something for it to do.'
                : `Matches ${reach} ${reach === 1 ? 'entry' : 'entries'} in your ledger.`}
          </p>
          <span className="flex gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!usable || !hasAction}
              onClick={() => {
                // Empty conditions would match nothing and only confuse the
                // description, so they never make it into the saved rule.
                onSave({ ...draft, label: draft.label.trim(), conditions: draft.conditions.filter((c) => c.value.trim() !== '') });
                onClose();
              }}
            >
              Save
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
