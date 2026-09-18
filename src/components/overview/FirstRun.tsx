import type { ReactNode } from 'react';
import { requestNavigate } from '../../lib/core/navigate';
import { useStore } from '../../lib/core/store';
import { LogoMark } from '../layout/Logo';
import { Reveal } from '../ui/Reveal';
import { IconEntries, IconSample, IconImport, IconLedger } from '../ui/icons';

/**
 * What an empty ledger shows instead of the dashboard.
 *
 * This is the only screen in the app with no data behind it, and for most
 * people it is the first one they see — which is exactly why it used to be the
 * weakest: a single dashed box saying "head to Entries" on an otherwise black
 * page, with no way to go there from the page telling you to. Every route out
 * of here is now a control on this screen.
 *
 * The three steps are ordered by what the rest of the app needs to say anything
 * at all: income sets the denominator every rate and projection is a share of,
 * one expense turns the charts on, and a statement import is the shortcut for
 * anyone who would rather not type six months in by hand.
 */
export function FirstRun() {
  const loadDemo = useStore((s) => s.loadDemo);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-12 text-center">
      <Reveal className="w-full max-w-3xl" stagger={0.07}>
        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/20">
          {/* Sits behind the mark rather than on the page, so the glow is part
              of the medallion and does not wash the copy underneath it. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_14%,transparent),transparent_70%)]"
          />
          <LogoMark className="h-8 w-8 text-ink" />
        </div>

        <h1 className="t-display text-ink">Your ledger is empty</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
          Log what comes in and what goes out. Budgets, goals, runway, net worth and the IRS
          headings are all derived from that one list — there is nothing else to set up.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Step
            icon={<IconEntries />}
            title="Set your income"
            description="A salary or anything else that arrives every month."
            onClick={() => requestNavigate({ tab: 'entries', section: 'log' })}
          />
          <Step
            icon={<IconLedger />}
            title="Log an expense"
            description="One is enough for the charts to start."
            onClick={() => requestNavigate({ tab: 'entries', section: 'log' })}
          />
          <Step
            icon={<IconImport />}
            title="Import a statement"
            description="Bring in CSV or OFX history instead of typing it."
            onClick={() => requestNavigate({ tab: 'entries', section: 'manage' })}
          />
        </div>

        {/* Set apart from the three steps rather than made a fourth one, because
            it is the opposite kind of action: those start a ledger, this one
            says don't start yet, look first. A fourth equal card would read as
            a fourth way to begin. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface-1/50 px-4 py-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-complement/10 text-complement-hover ring-1 ring-inset ring-complement/20 [&>svg]:h-4.5 [&>svg]:w-4.5">
            <IconSample />
          </span>
          <div className="min-w-0 flex-1">
            <span className="t-title block text-ink">Not sure yet? Explore with sample data</span>
            <span className="t-caption mt-0.5 block">
              Seven months of an invented ledger, so you can see every screen working before typing
              anything. Marked as sample throughout, and removable in one click.
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadDemo()}
            className="font-display shrink-0 cursor-pointer rounded-md border border-complement/40 px-3 py-1.5 text-sm font-semibold text-complement-hover transition-colors duration-200 hover:border-complement hover:bg-complement/10"
          >
            Load sample data
          </button>
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          Everything stays in this browser — no account, no server, no bank connection.{' '}
          <button
            type="button"
            onClick={() => requestNavigate({ tab: 'settings' })}
            className="cursor-pointer text-accent underline-offset-2 transition-colors duration-200 hover:text-accent-hover hover:underline"
          >
            Restore a backup
          </button>{' '}
          if you have one.
        </p>
      </Reveal>
    </div>
  );
}

function Step({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group card-pad cursor-pointer rounded-xl border border-hairline bg-surface-1 text-left transition-colors duration-200 hover:border-accent/40 hover:bg-surface-2"
    >
      <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-inset ring-accent/20 transition-colors duration-200 group-hover:bg-accent/15 [&>svg]:h-4.5 [&>svg]:w-4.5">
        {icon}
      </span>
      <span className="t-title block text-ink">{title}</span>
      <span className="t-caption mt-1 block">{description}</span>
    </button>
  );
}
