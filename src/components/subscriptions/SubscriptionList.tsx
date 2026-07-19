import { useState } from 'react';
import type { Subscription } from '../../lib/types';
import { useStore, useSubscriptions, useBuckets } from '../../lib/store';
import { nextRenewalDate, daysUntil, monthlyEquivalent, annualEquivalent } from '../../lib/subscriptions';
import { Badge, Button, Card, EmptyState, Modal, SectionTitle } from '../ui/primitives';
import { formatMoney, formatDate } from '../../lib/format';
import { SubscriptionForm } from './SubscriptionForm';

export function SubscriptionList() {
  const subscriptions = useSubscriptions();
  const buckets = useBuckets();
  const cancelSubscription = useStore((s) => s.cancelSubscription);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const active = subscriptions.filter((s) => !s.cancelled);
  const bucketName = (id: string) => buckets.find((b) => b.id === id)?.name ?? 'Unknown';
  const totalMonthly = active.reduce((s, sub) => s + monthlyEquivalent(sub), 0);
  const totalAnnual = active.reduce((s, sub) => s + annualEquivalent(sub), 0);

  return (
    <Card>
      <SectionTitle action={<Button onClick={() => setCreating(true)}>New subscription</Button>}>Subscriptions</SectionTitle>

      {active.length > 0 && (
        <div className="mb-4 flex gap-6 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Committed / month</p>
            <p className="font-semibold tabular-nums">{formatMoney(totalMonthly)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Committed / year</p>
            <p className="font-semibold tabular-nums">{formatMoney(totalAnnual)}</p>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState title="No subscriptions yet" description="Track recurring charges and see renewal countdowns." />
      ) : (
        <div className="space-y-2">
          {active.map((sub) => {
            const renewsAt = nextRenewalDate(sub);
            const days = daysUntil(renewsAt);
            const onTrial = !!sub.trialEndDate && new Date(sub.trialEndDate).getTime() > Date.now();
            return (
              <div key={sub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">{sub.name}</span>
                    {onTrial && <Badge tone="warn">Trial</Badge>}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {formatMoney(sub.amount)} / {sub.cycle} → {bucketName(sub.bucketId)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">Renews {formatDate(renewsAt.toISOString())}</p>
                    <Badge tone={days <= 2 ? 'bad' : days <= 7 ? 'warn' : 'neutral'}>{days <= 0 ? 'Today' : `${days}d`}</Badge>
                  </div>
                  <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(sub)}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="px-2 py-1 text-red-600" onClick={() => cancelSubscription(sub.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <Modal title="New subscription" onClose={() => setCreating(false)}>
          <SubscriptionForm onDone={() => setCreating(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit subscription" onClose={() => setEditing(null)}>
          <SubscriptionForm editing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </Card>
  );
}
