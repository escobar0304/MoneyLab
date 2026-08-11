import { useMemo, useState } from 'react';
import { useStore, useGoals } from '../../lib/store';
import { goalProgress, totalReserved, type GoalProgress } from '../../lib/goals';
import { totalBalance } from '../../lib/derive';
import { formatMoney, monthLabel, todayInputValue } from '../../lib/format';
import { Button, Card, Input, Label, SectionTitle, Badge, EmptyState } from '../ui/primitives';

interface Draft {
  label: string;
  target: string;
  targetDate: string;
  note: string;
}

const empty = (): Draft => ({ label: '', target: '', targetDate: '', note: '' });

const STATE_COPY: Record<GoalProgress['state'], { tone: 'good' | 'bad' | 'warn' | 'neutral'; text: string }> = {
  reached: { tone: 'good', text: 'Reached' },
  ahead: { tone: 'good', text: 'On track' },
  behind: { tone: 'bad', text: 'Behind' },
  'no-deadline': { tone: 'neutral', text: 'No deadline' },
  new: { tone: 'neutral', text: 'Too early to say' },
};

/**
 * One goal, its bar, and the two numbers that decide whether it happens.
 *
 * The bar shows progress against the target; the line under it compares the
 * pace being kept with the pace the deadline needs. A progress bar alone says
 * "42%", which is only good news or bad news once you know how long is left.
 */
function GoalRow({ progress }: { progress: GoalProgress }) {
  const contribute = useStore((s) => s.contributeToGoal);
  const remove = useStore((s) => s.removeGoal);
  const [amount, setAmount] = useState('');

  const { goal, saved, remaining, ratio, monthlyPace, requiredMonthly, projectedMonth, monthsLeft, state } = progress;
  const badge = STATE_COPY[state];
  const pct = Math.min(ratio, 1) * 100;

  const put = (sign: 1 | -1) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    contribute(goal.id, sign * value);
    setAmount('');
  };

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{goal.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="num-col text-ink-secondary">{formatMoney(saved)}</span> of{' '}
            <span className="num-col text-ink-secondary">{formatMoney(goal.target)}</span>
            {goal.targetDate && ` · by ${monthLabel(goal.targetDate.slice(0, 7))}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={badge.tone}>{badge.text}</Badge>
          <Button variant="ghost" onClick={() => remove(goal.id)} aria-label={`Remove ${goal.label}`}>
            Remove
          </Button>
        </div>
      </div>

      {/* Progress reads left to right against a full-width track, so the empty
          part is as visible as the filled part — that gap is the remaining. */}
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${goal.label} progress`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: state === 'behind' ? 'var(--color-complement)' : 'var(--color-accent)' }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          {remaining === 0 ? (
            'Fully funded.'
          ) : requiredMonthly !== null ? (
            <>
              Needs <span className="num-col text-ink-secondary">{formatMoney(requiredMonthly)}</span>/month
              {monthlyPace !== null && (
                <>
                  {' '}
                  · putting aside <span className="num-col text-ink-secondary">{formatMoney(monthlyPace)}</span>
                </>
              )}
            </>
          ) : monthsLeft !== null && monthsLeft <= 0 ? (
            <>
              Deadline passed with <span className="num-col text-ink-secondary">{formatMoney(remaining)}</span> to go
            </>
          ) : projectedMonth ? (
            <>At this pace, funded by {monthLabel(projectedMonth)}</>
          ) : (
            <>
              <span className="num-col text-ink-secondary">{formatMoney(remaining)}</span> to go
            </>
          )}
        </span>

        <span className="flex items-center gap-1.5">
          <span className="w-24">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && put(1)}
              placeholder="0,00"
              aria-label={`Amount to move for ${goal.label}`}
            />
          </span>
          <Button variant="secondary" onClick={() => put(1)} disabled={!(Number(amount) > 0)}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => put(-1)} disabled={!(Number(amount) > 0) || saved <= 0}>
            Release
          </Button>
        </span>
      </div>
    </div>
  );
}

/**
 * Money set aside for something specific.
 *
 * Contributing does not move money — it earmarks part of the balance you
 * already have. There is one pot in this app, so a goal that "held" money would
 * either double-count it or make the balance disagree with the bank. What the
 * header shows instead is what is left once everything spoken for is taken out,
 * which is the number that should govern whether you can afford something.
 */
export function GoalsManager() {
  const events = useStore((s) => s.events);
  const goals = useGoals();
  const upsert = useStore((s) => s.upsertGoal);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

  const progress = useMemo(() => goalProgress(events), [events]);
  const reserved = useMemo(() => totalReserved(events), [events]);
  const balance = useMemo(() => totalBalance(events), [events]);
  const free = balance - reserved;

  const valid = draft.label.trim() !== '' && Number(draft.target) > 0;

  const create = () => {
    if (!valid) return;
    upsert({
      label: draft.label.trim(),
      target: Number(draft.target),
      ...(draft.targetDate ? { targetDate: draft.targetDate } : {}),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    });
    setDraft(empty());
    setAdding(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ New goal'}</Button>}>
        Savings goals
      </SectionTitle>

      {goals.length > 0 && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-ink-muted">Unspoken for</p>
            <p className={`text-2xl font-semibold ${free < 0 ? 'text-critical-text' : 'text-ink'}`}>{formatMoney(free)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Set aside</p>
            <p className="num-col text-sm text-ink-secondary">{formatMoney(reserved)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Balance</p>
            <p className="num-col text-sm text-ink-secondary">{formatMoney(balance)}</p>
          </div>
          {free < 0 && (
            <p className="text-xs text-critical-text">
              More is earmarked than you hold — release some, or the goals are promises the balance can't keep.
            </p>
          )}
        </div>
      )}

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="goal-label">Goal</Label>
              <Input
                id="goal-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Emergency fund"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                type="number"
                min={0}
                step="0.01"
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                placeholder="6000"
              />
            </div>
            <div>
              <Label htmlFor="goal-date">By (optional)</Label>
              <Input
                id="goal-date"
                type="date"
                min={todayInputValue()}
                value={draft.targetDate}
                onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex-1">
              <Label htmlFor="goal-note">Note (optional)</Label>
              <Input
                id="goal-note"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                placeholder="Six months of expenses"
              />
            </div>
            <Button onClick={create} disabled={!valid}>
              Create goal
            </Button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="A goal earmarks part of your balance for something specific, and tells you whether your pace gets you there in time."
        />
      ) : (
        <div className="space-y-2">
          {progress.map((p) => (
            <GoalRow key={p.goal.id} progress={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
