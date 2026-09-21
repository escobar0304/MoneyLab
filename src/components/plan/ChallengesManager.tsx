import { useMemo, useState } from 'react';
import { useStore, useChallenges, useCategories } from '../../lib/core/store';
import { challengeProgress, type ChallengeProgress } from '../../lib/planning/challenges';
import { formatMoney, formatDate, todayInputValue } from '../../lib/core/format';
import { Badge, Button, Card, DateInput, EmptyState, Input, Label, SectionTitle } from '../ui/primitives';
import { IconTrophy } from '../ui/icons';


interface Draft {
  label: string;
  categories: Set<string>;
  startDate: string;
  endDate: string;
}

const empty = (): Draft => ({ label: '', categories: new Set(), startDate: todayInputValue(), endDate: '' });

const STATUS_COPY: Record<ChallengeProgress['status'], { tone: 'good' | 'bad' | 'warn' | 'neutral'; text: string }> = {
  upcoming: { tone: 'neutral', text: 'Starts soon' },
  active: { tone: 'good', text: 'In progress' },
  ended: { tone: 'neutral', text: 'Finished' },
};

/**
 * One challenge, its day-by-day track record, and nothing to enforce.
 *
 * The bar is read left to right the same way a goal's is: filled is what
 * already happened, not what's allowed to. A broken day stays visible rather
 * than being folded into a single percentage — the point is to see the
 * pattern, not just the score.
 */
function ChallengeRow({ progress }: { progress: ChallengeProgress }) {
  const remove = useStore((s) => s.removeChallenge);
  const { challenge, status, days, elapsed, cleanDays, brokenDays, currentStreak } = progress;
  const badge = STATUS_COPY[status];
  // A window that ran its full course without a single charge landing in it.
  // Only worth marking once it's over — a clean run with a week still to go is
  // an unfinished one, and congratulating it early is how a tracker starts
  // lying to the person using it.
  const perfect = status === 'ended' && elapsed.length > 0 && brokenDays === 0;

  return (
    <div className={`rounded-lg border p-3 ${perfect ? 'border-accent/35 bg-accent/6' : 'border-hairline'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
            {perfect && <IconTrophy className="h-4 w-4 shrink-0 text-accent" />}
            {challenge.label}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {challenge.categories.join(', ')} · {formatDate(challenge.startDate)} – {formatDate(challenge.endDate)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={badge.tone}>{badge.text}</Badge>
          <Button variant="ghost" onClick={() => remove(challenge.id)} aria-label={`Remove ${challenge.label}`}>
            Remove
          </Button>
        </div>
      </div>

      {/* One square per day in the window — clean days lit, broken days not,
          days not reached yet left hollow. A dashboard chart would average
          this into one number; the pattern is the point here. */}
      <div className="mt-2.5 flex flex-wrap gap-1" role="img" aria-label={`${cleanDays} of ${elapsed.length} days clean so far`}>
        {days.map((d) => {
          const isElapsed = elapsed.some((e) => e.date === d.date);
          return (
            <span
              key={d.date}
              title={`${formatDate(d.date)}${isElapsed ? (d.clean ? ' · clean' : ` · ${d.broken.map((b) => `${b.category} ${formatMoney(b.amount)}`).join(', ')}`) : ' · not reached yet'}`}
              className="h-3 w-3 rounded-sm"
              style={{
                background: !isElapsed ? 'var(--color-surface-2)' : d.clean ? 'var(--color-positive)' : 'var(--color-complement)',
                opacity: !isElapsed ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        {elapsed.length === 0 ? (
          "Hasn't started yet."
        ) : perfect ? (
          <span className="text-positive">
            Clean run — all <span className="num-col">{elapsed.length}</span> days.
          </span>
        ) : (
          <>
            <span className="num-col text-ink-secondary">{cleanDays}</span> of{' '}
            <span className="num-col text-ink-secondary">{elapsed.length}</span> days clean
            {brokenDays > 0 && (
              <>
                {' · '}
                <span className="num-col text-complement">{brokenDays}</span> broken
              </>
            )}
            {currentStreak > 0 && (
              <>
                {' · '}
                <span className="num-col text-positive">{currentStreak}</span>-day streak
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * A self-imposed no-spend window over categories you pick — "no takeaway
 * for 30 days" — tracked, never enforced.
 *
 * Nothing here stops an expense from posting in a challenged category; it
 * only reports, day by day, whether the window stayed clean. A blocked
 * expense would just get logged a day late or in a different category, which
 * teaches nothing — a visible pattern of clean and broken days does.
 */
export function ChallengesManager() {
  const events = useStore((s) => s.events);
  const challenges = useChallenges();
  const categories = useCategories();
  const upsert = useStore((s) => s.upsertChallenge);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

  const progress = useMemo(() => challenges.map((c) => challengeProgress(events, c)), [events, challenges]);

  const valid = draft.label.trim() !== '' && draft.categories.size > 0 && draft.startDate !== '' && draft.endDate >= draft.startDate;

  const toggleCategory = (name: string) => {
    setDraft((d) => {
      const next = new Set(d.categories);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...d, categories: next };
    });
  };

  const create = () => {
    if (!valid) return;
    upsert({ label: draft.label.trim(), categories: Array.from(draft.categories), startDate: draft.startDate, endDate: draft.endDate });
    setDraft(empty());
    setAdding(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ New challenge'}</Button>}>
        No-spend challenges
      </SectionTitle>

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="challenge-label">Challenge</Label>
              <Input
                id="challenge-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="No takeaway"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="challenge-start">Starts</Label>
              <DateInput
                id="challenge-start" value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="challenge-end">Ends</Label>
              <DateInput
                id="challenge-end" min={draft.startDate}
                value={draft.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-3">
            <p className="t-label mb-1.5">Categories</p>
            {categories.length === 0 ? (
              <p className="text-xs text-ink-muted">Create a category on Entries first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleCategory(name)}
                    aria-pressed={draft.categories.has(name)}
                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                      draft.categories.has(name)
                        ? 'border-accent/40 bg-accent/15 text-accent'
                        : 'border-hairline text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button onClick={create} disabled={!valid}>
              Start challenge
            </Button>
          </div>
        </div>
      )}

      {challenges.length === 0 ? (
        <EmptyState
          icon={<IconTrophy />}
          title="No challenges yet"
          description="Pick a handful of categories and a window of days — this only ever reports what happened, it never blocks anything."
          action={adding ? undefined : { label: 'Start a challenge', onClick: () => setAdding(true) }}
        />
      ) : (
        <div className="space-y-2">
          {progress.map((p) => (
            <ChallengeRow key={p.challenge.id} progress={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
