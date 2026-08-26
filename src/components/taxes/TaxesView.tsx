import { useMemo, useState } from 'react';
import { useStore, useVehicles } from '../../lib/core/store';
import { fiscalCalendar, vehicleDeadlines } from '../../lib/tax/fiscalCalendar';
import { daysUntil } from '../../lib/core/recurrence';
import { formatMoney, formatDate, todayInputValue } from '../../lib/core/format';
import { Reveal } from '../ui/Reveal';
import { Button, Card, Input, Label, SectionTitle, EmptyState } from '../ui/primitives';
import type { IucInstallment, Vehicle } from '../../lib/core/types';

function when(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * Everything with a fixed date on it, in one list — the IRS filing deadline
 * and every vehicle's IUC payment(s), merged and sorted rather than living on
 * separate cards. A date is worth the same attention whichever ledger it
 * came from.
 */
function FiscalCalendarCard() {
  const events = useStore((s) => s.events);
  const deadlines = useMemo(() => fiscalCalendar(events), [events]);

  return (
    <Card level="primary">
      <SectionTitle>Fiscal calendar</SectionTitle>
      <ul className="space-y-1.5">
        {deadlines.map((d) => {
          const days = daysUntil(new Date(`${d.date}T12:00:00.000Z`));
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-hairline px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-ink">{d.label}</p>
                {d.note && <p className="mt-0.5 text-xs text-ink-muted">{d.note}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-3">
                <span className={`text-xs ${days <= 7 ? 'text-complement' : 'text-ink-muted'}`}>
                  {formatDate(d.date)} · {when(days)}
                </span>
                {d.amount !== undefined && <span className="num-col w-20 text-right font-medium text-ink">{formatMoney(d.amount)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-muted">
        The IRS deadline is stated, not derived — check it against the current year's actual dates. IUC amounts are whatever you
        typed in below, from your own notice; this app has no reliable way to compute them and does not try to.
      </p>
    </Card>
  );
}

interface Draft {
  plate: string;
  registrationDate: string;
  amount: string;
  note: string;
  installments: { date: string; amount: string }[];
}

const emptyDraft = (): Draft => ({ plate: '', registrationDate: '', amount: '', note: '', installments: [] });

/** Turns a draft's installment rows into stored `IucInstallment`s — the year
 * typed into each date is discarded, only the month/day (the anniversary)
 * matters. */
function toInstallments(rows: Draft['installments']): IucInstallment[] {
  return rows.filter((r) => r.date && Number(r.amount) > 0).map((r) => ({ monthDay: r.date.slice(5, 10), amount: Number(r.amount) }));
}

function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const events = useStore((s) => s.events);
  const remove = useStore((s) => s.removeVehicle);
  // Filtered out of the same real computation the calendar card uses, rather
  // than reconstructed for this vehicle alone — otherwise a settled
  // occurrence would vanish from the calendar above but linger here, since
  // there'd be no expenses in the row's own event list to settle it against.
  const deadlines = useMemo(() => vehicleDeadlines(events).filter((d) => d.id.startsWith(`${vehicle.id}-`)), [events, vehicle.id]);

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{vehicle.plate}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Registered {formatDate(vehicle.registrationDate)} · <span className="num-col text-ink-secondary">{formatMoney(vehicle.amount)}</span>
            /year
            {vehicle.note && ` · ${vehicle.note}`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => remove(vehicle.id)} aria-label={`Remove ${vehicle.plate}`}>
          Remove
        </Button>
      </div>
      <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
        {deadlines.length === 0 ? (
          <li className="text-xs text-ink-muted">Settled for this cycle.</li>
        ) : (
          deadlines.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-xs text-ink-muted">
              <span>{formatDate(d.date)}</span>
              <span className="num-col text-ink-secondary">{formatMoney(d.amount ?? 0)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/**
 * Vehicles, tracked only for when their IUC is due.
 *
 * The amount is typed in from the owner's own notice rather than computed —
 * see the note on `Vehicle` in types.ts for why. Installments are optional
 * and off by default: most cars still pay once a year, and this is here for
 * the (announced, not yet universal) rule that splits payment by amount owed.
 */
function VehiclesManager() {
  const vehicles = useVehicles();
  const upsert = useStore((s) => s.upsertVehicle);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const valid = draft.plate.trim() !== '' && draft.registrationDate !== '' && Number(draft.amount) > 0;

  const addInstallmentRow = () => setDraft((d) => ({ ...d, installments: [...d.installments, { date: '', amount: '' }] }));
  const removeInstallmentRow = (i: number) => setDraft((d) => ({ ...d, installments: d.installments.filter((_, idx) => idx !== i) }));
  const updateInstallmentRow = (i: number, patch: Partial<{ date: string; amount: string }>) =>
    setDraft((d) => ({ ...d, installments: d.installments.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) }));

  const create = () => {
    if (!valid) return;
    upsert({
      plate: draft.plate.trim().toUpperCase(),
      registrationDate: draft.registrationDate,
      amount: Number(draft.amount),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      ...(draft.installments.length > 0 ? { installments: toInstallments(draft.installments) } : {}),
    });
    setDraft(emptyDraft());
    setAdding(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add vehicle'}</Button>}>
        Vehicles
      </SectionTitle>

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="v-plate">Plate</Label>
              <Input id="v-plate" value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="00-AA-00" autoFocus />
            </div>
            <div>
              <Label htmlFor="v-reg">Registration date</Label>
              <Input
                id="v-reg"
                type="date"
                max={todayInputValue()}
                value={draft.registrationDate}
                onChange={(e) => setDraft({ ...draft, registrationDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-amount">Annual IUC</Label>
              <Input
                id="v-amount"
                type="number"
                min={0}
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="From your own notice"
              />
            </div>
          </div>

          <div className="mt-3">
            <Label htmlFor="v-note">Note (optional)</Label>
            <Input id="v-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Family car" />
          </div>

          <div className="mt-3 rounded-lg border border-hairline bg-surface-1 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Split into more than one payment {draft.installments.length > 0 && `(${draft.installments.length})`}
              </p>
              <Button variant="ghost" onClick={addInstallmentRow}>
                + Add payment
              </Button>
            </div>
            {draft.installments.length === 0 ? (
              <p className="mt-1 text-xs text-ink-muted">Leave empty for one payment covering the full amount, in the registration month.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {draft.installments.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-36">
                      <Input
                        type="date"
                        aria-label={`Payment ${i + 1} date`}
                        value={row.date}
                        onChange={(e) => updateInstallmentRow(i, { date: e.target.value })}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Payment ${i + 1} amount`}
                        value={row.amount}
                        onChange={(e) => updateInstallmentRow(i, { amount: e.target.value })}
                        placeholder="0,00"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove payment ${i + 1}`}
                      onClick={() => removeInstallmentRow(i)}
                      className="cursor-pointer text-ink-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {/* Only the day and month of each date matter — it recurs
                    every year on that anniversary, same as the vehicle's own
                    registration date does for the default single payment. */}
                <p className="text-xs text-ink-muted">Only the day and month of each date are kept — it repeats every year.</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button onClick={create} disabled={!valid}>
              Add vehicle
            </Button>
          </div>
        </div>
      )}

      {vehicles.length === 0 ? (
        <EmptyState title="No vehicles yet" description="Add one to see its IUC due date on the calendar above." />
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <VehicleRow key={v.id} vehicle={v} />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Dates that have to be paid on, kept apart from Plan and IRS.
 *
 * A goal or a budget is something you're steering; a filing deadline or a
 * vehicle's IUC is something that happens to you on a fixed day whether you
 * look at it or not — different enough in kind to want its own page rather
 * than another card competing for space on Plan.
 */
export function TaxesView() {
  return (
    <Reveal className="space-y-3" from="start">
      <FiscalCalendarCard />
      <VehiclesManager />
    </Reveal>
  );
}
