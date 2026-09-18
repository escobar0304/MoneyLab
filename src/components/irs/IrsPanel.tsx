import { useMemo, useState } from 'react';
import { useStore, useCategories } from '../../lib/core/store';
import { deductionSummary, totalDeduction, foldDeductionMap, IRS_DEDUCTIONS, type DeductionStatus } from '../../lib/tax/irs';
import { formatMoney } from '../../lib/core/format';
import { Button, Card, Input, Select, SectionTitle, Badge, EmptyState } from '../ui/primitives';
import { IconIrs } from '../ui/icons';
import { requestNavigate } from '../../lib/core/navigate';
import { AnimatedNumber } from '../ui/AnimatedNumber';

function Meter({ status }: { status: DeductionStatus }) {
  const setCap = useStore((s) => s.setDeductionCap);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(status.cap));

  const full = status.ratio >= 1;

  const save = () => {
    const next = Number(draft.replace(',', '.'));
    if (Number.isFinite(next) && next >= 0) setCap(status.rule.id, next);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {status.rule.label}{' '}
          <span className="text-xs font-normal text-ink-muted">{Math.round(status.rule.rate * 100)}% of what you spend</span>
        </p>
        <p className="text-sm">
          <span className="num-col font-semibold text-ink">{formatMoney(status.deduction)}</span>
          <span className="text-xs text-ink-muted"> of {formatMoney(status.cap)}</span>
          {full && (
            <>
              {' '}
              <Badge tone="good">Ceiling reached</Badge>
            </>
          )}
        </p>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(status.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={status.rule.label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${status.ratio * 100}%`, background: full ? 'var(--color-positive)' : 'var(--color-accent)' }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          {status.categories.length === 0 ? (
            <span className="text-ink-muted">No categories filed here — {status.rule.hint}</span>
          ) : (
            <>
              <span className="num-col text-ink-secondary">{formatMoney(status.spend)}</span> across{' '}
              {status.categories.join(', ')}
              {/* The figure that turns this from a report into a decision. */}
              {!full && status.headroomSpend > 0 && (
                <>
                  {' '}
                  · <span className="num-col text-ink-secondary">{formatMoney(status.headroomSpend)}</span> more spending would still
                  count
                </>
              )}
            </>
          )}
        </span>

        {editing ? (
          <span className="flex items-center gap-1.5">
            <span className="w-24">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
                aria-label={`Ceiling for ${status.rule.label}`}
                autoFocus
              />
            </span>
            <Button onClick={save}>Save</Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(status.cap));
              setEditing(true);
            }}
            // Named for its row: six buttons reading "edit ceiling" are six
            // identical, useless announcements to a screen reader.
            aria-label={`Edit ceiling for ${status.rule.label}`}
            className="cursor-pointer underline hover:text-ink-secondary"
          >
            {status.capIsCustom ? 'ceiling edited' : 'edit ceiling'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Progress against the IRS deduction ceilings, for one year.
 *
 * The arithmetic is trivial; the value is knowing in September that a ceiling
 * is still €400 of invoices away while there is time to do something about it.
 * By the time the settlement arrives it is a fact, not a decision.
 *
 * The rates and ceilings shipped here are the commonly published ones, but they
 * move with each state budget and depend on filing status — so every ceiling is
 * editable and the panel says plainly that they need checking.
 */
export function IrsPanel() {
  const events = useStore((s) => s.events);
  const categories = useCategories();
  const mapDeduction = useStore((s) => s.mapDeduction);

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const statuses = useMemo(() => deductionSummary(events, year), [events, year]);
  const map = useMemo(() => foldDeductionMap(events), [events]);
  const total = totalDeduction(statuses);

  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    for (const e of events) if (e.type === 'expense') set.add(Number(e.timestamp.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  }, [events, thisYear]);

  const mapped = Array.from(map.keys()).length;

  return (
    <Card>
      <SectionTitle
        action={
          <div className="w-28">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        IRS deductions
      </SectionTitle>

      <div className="mb-3">
        <p className="t-label">Deductible in {year}</p>
        <p className="t-metric text-ink">
          <AnimatedNumber value={total} format={formatMoney} />
        </p>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<IconIrs />}
          title="No categories yet"
          description="Deductions attach to your expense categories, so create some first."
          action={{ label: 'Go to Entries', onClick: () => requestNavigate({ tab: 'entries', section: 'log' }) }}
        />
      ) : (
        <>
          {/* Nothing works until categories are filed, so the mapping comes
              first rather than being hidden behind a settings screen. */}
          <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Categories {mapped > 0 && <span className="font-normal normal-case">({mapped} filed)</span>}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categories.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink-secondary">{name}</span>
                  <span className="w-44 shrink-0">
                    <Select
                      value={map.get(name) ?? ''}
                      onChange={(e) => mapDeduction(name, e.target.value || null)}
                      aria-label={`Deduction heading for ${name}`}
                    >
                      <option value="">Not deductible</option>
                      {IRS_DEDUCTIONS.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.label}
                        </option>
                      ))}
                    </Select>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {statuses.map((status) => (
              <Meter key={status.rule.id} status={status} />
            ))}
          </div>
        </>
      )}

      {/* Said once, plainly. Getting this wrong in the user's favour would be
          worse than not showing it at all. */}
      <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-muted">
        The rates and ceilings above are the commonly published ones, but they move with each state budget and depend on your
        household. Check them against your own situation — every ceiling here is editable. This is an estimate from what you
        logged, not an official simulation.
      </p>
    </Card>
  );
}
