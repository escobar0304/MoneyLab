import { useMemo, useState } from 'react';
import { useStore } from '../../lib/core/store';
import { detectSubscriptions, subscriptionTotal, type DetectedSubscription } from '../../lib/money/subscriptions';
import { formatMoney, formatDate } from '../../lib/core/format';
import { Button, Card, SectionTitle, Badge, EmptyState } from '../ui/primitives';

function Row({ sub }: { sub: DetectedSubscription }) {
  const upsertRecurring = useStore((s) => s.upsertRecurring);
  const [added, setAdded] = useState(false);

  const declare = () => {
    upsertRecurring({
      kind: 'expense',
      label: sub.label,
      amount: sub.lastAmount,
      category: sub.category,
      startDate: sub.lastDate.slice(0, 10),
      active: true,
    });
    setAdded(true);
  };

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {sub.label}
            {sub.drift && <Badge tone={sub.drift.pct > 0 ? 'bad' : 'good'}>{sub.drift.pct > 0 ? '↑' : '↓'} {Math.abs(sub.drift.pct)}%</Badge>}
            {sub.ruled && <Badge>Has a rule</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="num-col text-ink-secondary">{formatMoney(sub.lastAmount)}</span>{' '}
            {sub.cadence === 'monthly' ? 'a month' : 'a year'} · {sub.charges.length} charges · last {formatDate(sub.lastDate)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-right">
            <span className="block text-xs text-ink-muted">a year</span>
            <span className="num-col text-sm font-medium text-ink-secondary">{formatMoney(sub.yearlyCost)}</span>
          </span>
          {!sub.ruled && !added && (
            <Button variant="secondary" onClick={declare}>
              Make it a rule
            </Button>
          )}
          {added && <Badge tone="good">Rule created</Badge>}
        </div>
      </div>

      {/* The reason this panel exists. Both figures are individually plausible,
          so nothing else in the app would ever show the difference. */}
      {sub.drift && (
        <p className="mt-2 border-t border-hairline pt-2 text-xs text-ink-secondary">
          Was <span className="num-col">{formatMoney(sub.drift.from)}</span>, now{' '}
          <span className="num-col">{formatMoney(sub.drift.to)}</span> —{' '}
          <span className={sub.drift.pct > 0 ? 'text-complement' : 'text-positive'}>
            {sub.drift.pct > 0 ? 'up' : 'down'} {formatMoney(Math.abs(sub.drift.to - sub.drift.from))} a{' '}
            {sub.cadence === 'monthly' ? 'month' : 'year'}
          </span>
          {sub.cadence === 'monthly' && (
            <>
              , {formatMoney(Math.abs(sub.drift.to - sub.drift.from) * 12)} a year
            </>
          )}
          .{sub.ruled && ' The recurring rule still has the old amount.'}
        </p>
      )}

      {sub.overdueDays !== null && (
        <p className="mt-2 border-t border-hairline pt-2 text-xs text-ink-muted">
          Expected another charge {sub.overdueDays} days ago. Either it was cancelled, or it hasn't been logged.
        </p>
      )}
    </div>
  );
}

/**
 * Repeating charges found in what is already logged.
 *
 * Nothing here is entered by the user — it is all inference over the ledger,
 * and it pays for itself in two ways. It surfaces subscriptions nobody declared
 * and has stopped noticing, and it catches **price drift**: the rule still says
 * €900 while the last three payments were €950. That gap is invisible in every
 * chart in this app, because both numbers look perfectly normal on their own.
 */
export function Subscriptions() {
  const events = useStore((s) => s.events);
  const [showAll, setShowAll] = useState(false);

  const all = useMemo(() => detectSubscriptions(events), [events]);
  const undeclared = all.filter((s) => !s.ruled);
  const drifting = all.filter((s) => s.drift);
  const shown = showAll ? all : all.filter((s) => !s.ruled || s.drift);

  return (
    <Card>
      <SectionTitle
        action={
          all.length > shown.length || showAll ? (
            <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Only what needs attention' : `Show all ${all.length}`}
            </Button>
          ) : undefined
        }
      >
        Repeating charges
      </SectionTitle>

      {all.length === 0 ? (
        <EmptyState
          title="Nothing repeating yet"
          description="Once the same charge has appeared three times at a steady amount, it shows up here — along with any price rise."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted">
            <span className="num-col text-ink-secondary">{formatMoney(subscriptionTotal(all))}</span> a year across{' '}
            {all.length} repeating {all.length === 1 ? 'charge' : 'charges'}
            {undeclared.length > 0 && `, ${undeclared.length} without a rule`}
            {drifting.length > 0 && `, ${drifting.length} that changed price`}.
          </p>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">
              Everything repeating is declared and unchanged.
            </p>
          ) : (
            <div className="space-y-2">
              {shown.map((sub) => (
                <Row key={sub.key} sub={sub} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
