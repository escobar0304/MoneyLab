import type { AllocationRule, Bucket } from '../../lib/types';
import { UNALLOCATED_BUCKET_ID } from '../../lib/types';
import { makeId } from '../../lib/id';
import { ruleBaseAmounts, unallocatedRemainder } from '../../lib/allocation';
import { Badge, Button, Input, Select } from '../ui/primitives';
import { formatSignedMoney } from '../../lib/format';

function emptyRule(bucketId: string): AllocationRule {
  return { id: makeId(), bucketId, mode: 'percent', value: 0 };
}

export function AllocationRuleBuilder({
  rules,
  onChange,
  buckets,
  baseAmount,
  depth = 0,
}: {
  rules: AllocationRule[];
  onChange: (rules: AllocationRule[]) => void;
  buckets: Bucket[];
  baseAmount: number;
  depth?: number;
}) {
  const selectable = buckets.filter((b) => !b.archived && b.id !== UNALLOCATED_BUCKET_ID);
  const bases = ruleBaseAmounts(baseAmount, rules);
  const remainder = unallocatedRemainder(baseAmount, rules);

  const update = (index: number, patch: Partial<AllocationRule>) => {
    const next = rules.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));
  const add = () => onChange([...rules, emptyRule(selectable[0]?.id ?? '')]);

  return (
    <div className={depth > 0 ? 'ml-2 border-l border-neutral-200 pl-3 sm:ml-4 sm:pl-4' : ''}>
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={rule.id} className="rounded-lg border border-neutral-200 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="min-w-[130px] flex-1"
                value={rule.bucketId}
                onChange={(e) => update(i, { bucketId: e.target.value })}
              >
                {selectable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Select
                className="w-[6.5rem] shrink-0"
                value={rule.mode}
                onChange={(e) => update(i, { mode: e.target.value as AllocationRule['mode'] })}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed $</option>
                <option value="remainder">Remainder</option>
              </Select>
              {rule.mode !== 'remainder' && (
                <Input
                  type="number"
                  className="w-20 shrink-0"
                  value={rule.value}
                  onChange={(e) => update(i, { value: Number(e.target.value) })}
                  min={0}
                  step={rule.mode === 'percent' ? 1 : 0.01}
                />
              )}
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                {formatSignedMoney(bases.get(rule.id) ?? 0)}
              </span>
              <button
                type="button"
                className="shrink-0 px-1 text-neutral-400 hover:text-red-600"
                onClick={() => remove(i)}
                aria-label="Remove rule"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 pl-0.5">
              {rule.subRules ? (
                <>
                  <AllocationRuleBuilder
                    rules={rule.subRules}
                    onChange={(sub) => update(i, { subRules: sub })}
                    buckets={buckets}
                    baseAmount={bases.get(rule.id) ?? 0}
                    depth={depth + 1}
                  />
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-neutral-400 hover:text-red-600"
                    onClick={() => update(i, { subRules: undefined })}
                  >
                    Remove sub-split
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                  onClick={() => update(i, { subRules: [emptyRule(selectable[0]?.id ?? '')] })}
                >
                  + Split this share further
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" className="text-xs" onClick={add}>
          + Add rule
        </Button>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          Unallocated
          <Badge tone={remainder < 0 ? 'bad' : remainder > 0 ? 'warn' : 'good'}>{formatSignedMoney(remainder)}</Badge>
        </div>
      </div>
    </div>
  );
}
