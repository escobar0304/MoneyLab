import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../../lib/core/store';
import { foldRecurring } from '../../../lib/core/entities';
import { applyWhatIf, monthlyEffect, type WhatIfAdjustment } from '../../../lib/planning/whatif';
import { projectRunway } from '../../../lib/planning/runway';
import { makeId } from '../../../lib/core/id';
import { formatMoney, formatSignedMoney } from '../../../lib/core/format';
import { PRIMARY, COMPLEMENT, CHART_INK } from '../../../lib/insight/chartTheme';
import { ChartLegend, Plot, crosshair, gridProps, plotMargin, xAxisProps, yAxisProps, niceSpan } from '../../ui/chartChrome';
import { Button, Input, Modal, Select } from '../../ui/primitives';
import { Segmented } from '../../ui/Segmented';
import type { RecurringKind } from '../../../lib/core/types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** How far ahead the comparison runs — long enough for a recurring change to
 * compound across several cycles, short enough to still read as "soon". */
const HORIZON_DAYS = 180;

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The same sign `monthlyEffect` uses per-adjustment, so a chip's colour and
 * the total it feeds into never disagree. */
function adjustmentSign(adj: WhatIfAdjustment): 1 | -1 {
  const base = adj.direction === 'income' ? 1 : -1;
  return adj.kind === 'cancel' ? ((-base) as 1 | -1) : (base as 1 | -1);
}

type FormKind = 'recurring' | 'oneOff' | 'cancel';
const FORM_KINDS: { id: FormKind; label: string }[] = [
  { id: 'recurring', label: 'New recurring' },
  { id: 'oneOff', label: 'One-off' },
  { id: 'cancel', label: 'Cancel a rule' },
];

/** The form that turns "what if I..." into one `WhatIfAdjustment`. */
function AddAdjustment({ onAdd }: { onAdd: (adj: WhatIfAdjustment) => void }) {
  const events = useStore((s) => s.events);
  const [formKind, setFormKind] = useState<FormKind>('recurring');
  const [direction, setDirection] = useState<RecurringKind>('expense');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [recurringId, setRecurringId] = useState('');

  // Only what's actually live — a rule already cancelled for real has nothing
  // left here to hypothetically cancel again.
  const activeRules = useMemo(() => foldRecurring(events).filter((r) => r.active), [events]);

  const submit = () => {
    if (formKind === 'cancel') {
      const rule = activeRules.find((r) => r.id === recurringId);
      if (!rule) return;
      onAdd({ id: makeId(), kind: 'cancel', recurringId: rule.id, direction: rule.kind, label: rule.label, amount: rule.amount });
      setRecurringId('');
      return;
    }
    const amt = Number(amount.replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0 || !label.trim()) return;
    onAdd({ id: makeId(), kind: formKind, direction, label: label.trim(), amount: roundCents(amt) });
    setLabel('');
    setAmount('');
  };

  return (
    <div className="rounded-lg border border-hairline p-3">
      <Segmented options={FORM_KINDS} value={formKind} onChange={setFormKind} label="Kind of change" />

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {formKind === 'cancel' ? (
          activeRules.length === 0 ? (
            <p className="text-xs text-ink-muted">No active recurring rules to cancel.</p>
          ) : (
            <div className="min-w-[12rem] flex-1">
              <Select value={recurringId} onChange={(e) => setRecurringId(e.target.value)} aria-label="Rule to cancel">
                <option value="">Choose a rule…</option>
                {activeRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} — {formatMoney(r.amount)}/mo
                  </option>
                ))}
              </Select>
            </div>
          )
        ) : (
          <>
            <div className="w-28 shrink-0">
              <Select value={direction} onChange={(e) => setDirection(e.target.value as RecurringKind)} aria-label="Income or expense">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div className="min-w-[9rem] flex-1">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" aria-label="Label" />
            </div>
            <div className="w-28 shrink-0">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                aria-label="Amount"
                inputMode="decimal"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          </>
        )}
        <Button onClick={submit} disabled={formKind === 'cancel' ? !recurringId : !label.trim() || !amount}>
          Add
        </Button>
      </div>
    </div>
  );
}

function AdjustmentList({ adjustments, onRemove }: { adjustments: WhatIfAdjustment[]; onRemove: (id: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {adjustments.map((adj) => {
        const sign = adjustmentSign(adj);
        return (
          <li key={adj.id} className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-secondary">
              {adj.kind === 'cancel' ? `Cancel ${adj.label}` : adj.label}
              <span className="text-ink-muted"> · {adj.kind === 'oneOff' ? 'once' : 'monthly'}</span>
            </span>
            <span className={`num-col text-xs font-medium ${sign > 0 ? 'text-positive' : 'text-complement'}`}>
              {sign > 0 ? '+' : '−'}
              {formatMoney(adj.amount)}
            </span>
            <button
              type="button"
              aria-label={`Remove ${adj.label}`}
              onClick={() => onRemove(adj.id)}
              className="cursor-pointer text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface WhatIfPoint {
  date: string;
  baseline: number;
  whatif: number;
}

function WhatIfTooltip({ active, payload }: { active?: boolean; payload?: { payload?: WhatIfPoint }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs float-material">
      <p className="mb-1.5 text-ink-muted">{shortDate(point.date)}</p>
      <p className="flex items-center gap-2">
        <span style={{ color: CHART_INK.muted }}>—</span>
        <span className="num-col text-ink-secondary">{formatMoney(point.baseline)}</span> if nothing changes
      </p>
      <p className="flex items-center gap-2">
        <span style={{ color: PRIMARY }}>—</span>
        <span className="num-col text-ink">{formatMoney(point.whatif)}</span> with this change
      </p>
    </div>
  );
}

/**
 * The comparison itself — the real ledger's projected balance against the
 * same projection run on a copy carrying the hypothetical changes.
 *
 * Nothing here is a new kind of arithmetic: `projectRunway` is the exact
 * function the "next 60 days" card on Overview already trusts, called twice —
 * once on `events`, once on `applyWhatIf(events, adjustments)`. A "what if" is
 * that function pointed at a ledger that doesn't exist yet.
 */
function WhatIfComparison({ adjustments }: { adjustments: WhatIfAdjustment[] }) {
  const events = useStore((s) => s.events);
  const now = useMemo(() => new Date(), []);

  const base = useMemo(() => projectRunway(events, { days: HORIZON_DAYS, now }), [events, now]);
  const hypEvents = useMemo(() => applyWhatIf(events, adjustments, now), [events, adjustments, now]);
  const hyp = useMemo(() => projectRunway(hypEvents, { days: HORIZON_DAYS, now }), [hypEvents, now]);

  const effect = monthlyEffect(adjustments);
  const chartData: WhatIfPoint[] = useMemo(
    () => base.days.map((d, i) => ({ date: d.date, baseline: d.expected, whatif: hyp.days[i]?.expected ?? d.expected })),
    [base, hyp]
  );
  const values = chartData.flatMap((d) => [d.baseline, d.whatif]);
  const scale = niceSpan(Math.min(...values, 0), Math.max(...values, 0));
  const lineColor = effect >= 0 ? PRIMARY : COMPLEMENT;

  const endBase = base.days.at(-1)?.expected ?? 0;
  const endHyp = hyp.days.at(-1)?.expected ?? 0;

  let verdict: string;
  if (hyp.shortfall && base.shortfall) {
    const shift = hyp.daysOfRunway! - base.daysOfRunway!;
    verdict =
      shift === 0
        ? `Still runs out on ${shortDate(hyp.shortfall.date)}, same as today.`
        : `Runs out on ${shortDate(hyp.shortfall.date)} — ${Math.abs(shift)} days ${shift > 0 ? 'later' : 'sooner'} than today.`;
  } else if (hyp.shortfall && !base.shortfall) {
    verdict = `This would run the balance out on ${shortDate(hyp.shortfall.date)}, ${HORIZON_DAYS} days from now it stays positive otherwise.`;
  } else if (!hyp.shortfall && base.shortfall) {
    verdict = `This avoids the shortfall — today's path runs out on ${shortDate(base.shortfall.date)}.`;
  } else {
    verdict = `In ${HORIZON_DAYS} days: ${formatMoney(endHyp)} instead of ${formatMoney(endBase)}.`;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-hairline p-3">
        <p className="t-label">Effect on next month</p>
        <p className={`t-title mt-1 ${effect >= 0 ? 'text-positive' : 'text-complement'}`}>
          {effect >= 0 ? '+' : ''}
          {formatSignedMoney(effect)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{verdict}</p>
      </div>

      <div>
        <ChartLegend
          payload={[
            { value: 'If nothing changes', color: CHART_INK.muted },
            { value: 'With this change', color: lineColor },
          ]}
        />
        <Plot>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={plotMargin}>
              <defs>
                <linearGradient id="whatifFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={shortDate} {...xAxisProps} minTickGap={44} />
              <YAxis {...yAxisProps} domain={scale.domain} ticks={scale.ticks} />
              <ReferenceLine y={0} stroke={CHART_INK.axis} strokeWidth={1} />
              <Tooltip cursor={crosshair} content={<WhatIfTooltip />} />
              <Area
                type="monotone"
                dataKey="baseline"
                stroke={CHART_INK.muted}
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="none"
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="whatif"
                stroke={lineColor}
                strokeWidth={2}
                fill="url(#whatifFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Plot>
      </div>
    </div>
  );
}

/**
 * A sandbox for a change not yet made — a raise not yet negotiated, a
 * subscription not yet cancelled — tried against the real ledger without
 * logging anything.
 *
 * The trick is the same one Time Travel uses in reverse: every figure in this
 * app is computed fresh from an `events[]` array, so "what if" only needs a
 * second, throwaway copy of that array with a few synthetic events on top.
 * Closing this modal discards it; nothing is ever written to the store.
 */
export function WhatIfLab() {
  const [open, setOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<WhatIfAdjustment[]>([]);

  const add = (adj: WhatIfAdjustment) => setAdjustments((prev) => [...prev, adj]);
  const remove = (id: string) => setAdjustments((prev) => prev.filter((a) => a.id !== id));

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        What if?
      </Button>

      {open && (
        <Modal title="What if?" onClose={() => setOpen(false)} width="lg">
          <p className="mb-4 text-sm text-ink-secondary">
            Try a raise, a new bill, or cancelling a subscription against your real numbers. Nothing here is saved — closing this
            throws it away.
          </p>

          <AddAdjustment onAdd={add} />

          {adjustments.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-muted">
              Add a change above to see what it would do to the months ahead.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <AdjustmentList adjustments={adjustments} onRemove={remove} />
              <WhatIfComparison adjustments={adjustments} />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
