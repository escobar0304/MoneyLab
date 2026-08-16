import { useMemo, useState } from 'react';
import { useStore, useDebts } from '../../lib/store';
import { debtSummary, overpaymentEffect, scheduledPayment, totalOwed } from '../../lib/debt';
import type { Debt } from '../../lib/types';
import { formatMoney, monthLabel, todayInputValue } from '../../lib/format';
import { Button, Card, Input, Label, SectionTitle, Badge, EmptyState } from '../ui/primitives';
import { AmortizationChart } from './AmortizationChart';

interface Draft {
  label: string;
  principal: string;
  annualRate: string;
  termMonths: string;
  startDate: string;
  extraPayment: string;
}

const empty = (): Draft => ({ label: '', principal: '', annualRate: '', termMonths: '360', startDate: todayInputValue(), extraPayment: '' });

/** A figure with its caption, for the row of numbers under each debt. */
function Figure({ label, value, tone = 'secondary' }: { label: string; value: string; tone?: 'secondary' | 'complement' | 'ink' }) {
  const colors = { secondary: 'text-ink-secondary', complement: 'text-complement', ink: 'text-ink' };
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`num-col text-sm font-medium ${colors[tone]}`}>{value}</dd>
    </div>
  );
}

function DebtRow({ debt }: { debt: Debt }) {
  const remove = useStore((s) => s.removeDebt);
  const upsert = useStore((s) => s.upsertDebt);
  const upsertRecurring = useStore((s) => s.upsertRecurring);
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState('100');

  const summary = useMemo(() => debtSummary(debt), [debt]);
  const effect = useMemo(() => {
    const amount = Number(extra);
    return Number.isFinite(amount) && amount > 0 ? overpaymentEffect(debt, amount) : null;
  }, [debt, extra]);

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {debt.label}{' '}
            <span className="text-ink-muted">
              {debt.annualRate.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}% · {debt.termMonths} months
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Borrowed <span className="num-col text-ink-secondary">{formatMoney(debt.principal)}</span> ·{' '}
            {summary.paymentsMade} of {summary.paymentsMade + summary.paymentsRemaining} payments made
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {summary.settled ? <Badge tone="good">Settled</Badge> : !debt.active && <Badge>Paused</Badge>}
          <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </Button>
          <Button variant="ghost" onClick={() => remove(debt.id)} aria-label={`Remove ${debt.label}`}>
            Remove
          </Button>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-2.5 sm:grid-cols-4">
        <Figure label="Still owed" value={formatMoney(summary.balance)} tone="ink" />
        <Figure label="Monthly" value={formatMoney(summary.monthlyPayment)} />
        <Figure label="Interest left" value={formatMoney(summary.interestRemaining)} tone="complement" />
        <Figure label="Paid off in" value={summary.payoffMonth ? monthLabel(summary.payoffMonth) : '—'} />
      </dl>

      {open && (
        <div className="mt-3 space-y-3 border-t border-hairline pt-3">
          {/* Total interest is the number a rate is really asking you to accept,
              and it is never the number on the contract's front page. */}
          <p className="text-xs text-ink-muted">
            Over the full term this loan costs{' '}
            <span className="num-col font-medium text-complement">{formatMoney(summary.totalInterest)}</span> in interest — that is{' '}
            {(summary.interestRatio * 100).toFixed(0)}% on top of what you borrowed.
          </p>

          <AmortizationChart debt={debt} />

          <div className="rounded-lg border border-hairline bg-surface-0 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Paying extra</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="w-32">
                <Label htmlFor={`extra-${debt.id}`}>Extra per month</Label>
                <Input
                  id={`extra-${debt.id}`}
                  type="number"
                  min={0}
                  step="10"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                />
              </div>
              {effect && effect.monthsSaved > 0 ? (
                <p className="text-sm text-ink-secondary">
                  Finishes <span className="font-semibold text-ink">{effect.monthsSaved} months</span> earlier
                  {effect.payoffMonth && ` (${monthLabel(effect.payoffMonth)})`} and saves{' '}
                  <span className="num-col font-semibold text-positive">{formatMoney(effect.interestSaved)}</span> in interest.
                </p>
              ) : (
                <p className="text-sm text-ink-muted">Enter an amount to see what it would shorten.</p>
              )}
              {effect && effect.monthsSaved > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => upsert({ ...debt, extraPayment: (debt.extraPayment ?? 0) + Number(extra) })}
                >
                  Commit to it
                </Button>
              )}
            </div>
            {debt.extraPayment ? (
              <p className="mt-2 text-xs text-ink-muted">
                Already overpaying <span className="num-col text-ink-secondary">{formatMoney(debt.extraPayment)}</span> a month.{' '}
                <button type="button" onClick={() => upsert({ ...debt, extraPayment: 0 })} className="cursor-pointer underline hover:text-ink-secondary">
                  Stop
                </button>
              </p>
            ) : null}
          </div>

          {/* The payment is a real monthly expense; without this the loan would
              be modelled here and invisible in the budget. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                upsertRecurring({
                  kind: 'expense',
                  label: debt.label,
                  amount: summary.monthlyPayment,
                  category: 'Loan repayment',
                  startDate: debt.startDate,
                  active: true,
                })
              }
            >
              Add the payment as a recurring expense
            </Button>
            <Button variant="ghost" onClick={() => upsert({ ...debt, active: !debt.active })}>
              {debt.active ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Loans, and what they actually cost.
 *
 * A mortgage is usually the largest single financial fact about a household and
 * it was entirely absent from this app — net worth counted the flat's deposit
 * but not the debt against it. The rate is entered as the lender quotes it and
 * the schedule is re-derived from that: for a variable Portuguese mortgage this
 * reads as "what happens if the rate stays where it is", which is the only
 * honest projection available without forecasting Euribor.
 */
export function DebtManager() {
  const debts = useDebts();
  const upsert = useStore((s) => s.upsertDebt);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

  const owed = useMemo(() => totalOwed(debts), [debts]);
  const monthly = useMemo(
    () =>
      debts
        .filter((d) => d.active)
        .reduce((sum, d) => sum + scheduledPayment(d.principal, d.annualRate, d.termMonths) + (d.extraPayment ?? 0), 0),
    [debts]
  );

  const valid = draft.label.trim() !== '' && Number(draft.principal) > 0 && Number(draft.termMonths) > 0 && Number(draft.annualRate) >= 0;

  const create = () => {
    if (!valid) return;
    upsert({
      label: draft.label.trim(),
      principal: Number(draft.principal),
      annualRate: Number(draft.annualRate),
      termMonths: Math.round(Number(draft.termMonths)),
      startDate: draft.startDate,
      ...(Number(draft.extraPayment) > 0 ? { extraPayment: Number(draft.extraPayment) } : {}),
      active: true,
    });
    setDraft(empty());
    setAdding(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add loan'}</Button>}>
        Debt
      </SectionTitle>

      {debts.length > 0 && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-ink-muted">Still owed</p>
            <p className="t-metric text-ink">{formatMoney(owed)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Per month</p>
            <p className="num-col text-sm text-ink-secondary">{formatMoney(monthly)}</p>
          </div>
        </div>
      )}

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="debt-label">Loan</Label>
              <Input
                id="debt-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Mortgage"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="debt-principal">Amount borrowed</Label>
              <Input
                id="debt-principal"
                type="number"
                min={0}
                step="0.01"
                value={draft.principal}
                onChange={(e) => setDraft({ ...draft, principal: e.target.value })}
                placeholder="180000"
              />
            </div>
            <div>
              <Label htmlFor="debt-rate">Annual rate %</Label>
              <Input
                id="debt-rate"
                type="number"
                min={0}
                step="0.01"
                value={draft.annualRate}
                onChange={(e) => setDraft({ ...draft, annualRate: e.target.value })}
                placeholder="3.4"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="debt-term">Term in months</Label>
              <Input
                id="debt-term"
                type="number"
                min={1}
                step="1"
                value={draft.termMonths}
                onChange={(e) => setDraft({ ...draft, termMonths: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="debt-start">First payment</Label>
              <Input
                id="debt-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="debt-extra">Overpayment (optional)</Label>
              <Input
                id="debt-extra"
                type="number"
                min={0}
                step="10"
                value={draft.extraPayment}
                onChange={(e) => setDraft({ ...draft, extraPayment: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {/* The instalment is shown before saving, because it is the number
                that says whether the term entered was the one intended. */}
            <p className="text-xs text-ink-muted">
              {valid ? (
                <>
                  Monthly payment:{' '}
                  <span className="num-col font-medium text-ink-secondary">
                    {formatMoney(scheduledPayment(Number(draft.principal), Number(draft.annualRate), Math.round(Number(draft.termMonths))))}
                  </span>
                </>
              ) : (
                'Fill in the amount, rate and term.'
              )}
            </p>
            <Button onClick={create} disabled={!valid}>
              Add loan
            </Button>
          </div>
        </div>
      )}

      {debts.length === 0 ? (
        <EmptyState
          title="No loans recorded"
          description="Adding a mortgage or car loan makes Net worth honest, and shows what the interest really costs over the term."
        />
      ) : (
        <div className="space-y-2">
          {debts.map((d) => (
            <DebtRow key={d.id} debt={d} />
          ))}
        </div>
      )}
    </Card>
  );
}
