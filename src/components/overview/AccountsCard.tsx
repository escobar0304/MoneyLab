import { useMemo } from 'react';
import { useStore, useVisibleEvents } from '../../lib/store';
import { foldAccounts, accountBalances } from '../../lib/accounts';
import { stableColorMap } from '../../lib/chartTheme';
import { formatMoney } from '../../lib/format';
import { Card } from '../ui/primitives';

/**
 * Where the balance actually sits.
 *
 * Only rendered once there is more than one pot — with a single account this
 * card would restate the hero figure a second time, one line lower.
 *
 * Derives from the time-travelled event list, so it answers "what was in savings
 * in March" along with everything else on the page.
 */
export function AccountsCard() {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);

  const { accounts, balances, total } = useMemo(() => {
    const accounts = foldAccounts(events);
    const balances = accountBalances(events, accounts);
    return { accounts, balances, total: Array.from(balances.values()).reduce((a, b) => a + b, 0) };
  }, [events]);

  const colors = useMemo(() => stableColorMap(accounts.map((a) => a.id)), [accounts]);
  if (accounts.length < 2) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="t-title text-ink">Accounts</p>
        <p className="t-caption">
          <span className="num-col text-ink-secondary">{formatMoney(total)}</span> in total
        </p>
      </div>

      {total > 0 && (
        <div
          className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label={`Split: ${accounts.map((a) => `${a.label} ${Math.round(((balances.get(a.id) ?? 0) / total) * 100)}%`).join(', ')}`}
        >
          {accounts.map((a) => {
            const share = Math.max(((balances.get(a.id) ?? 0) / total) * 100, 0);
            return share > 0 ? (
              <span
                key={a.id}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${share}%`, backgroundColor: colors.get(a.id) }}
              />
            ) : null;
          })}
        </div>
      )}

      <ul className="mt-3 space-y-1">
        {accounts.map((a) => {
          const balance = balances.get(a.id) ?? 0;
          const share = total > 0 ? (balance / total) * 100 : 0;
          return (
            <li key={a.id}>
              {/* The row is the drill target: an account is a slice of the
                  ledger like any chart mark, so it opens the same way. */}
              <button
                type="button"
                onClick={() =>
                  openDrill({
                    title: a.label,
                    subtitle: 'Everything filed to this account',
                    filter: { accountId: a.id },
                  })
                }
                className="row-pad flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-1 text-left text-sm transition-colors hover:bg-surface-2/60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(a.id) }} aria-hidden="true" />
                  <span className="truncate text-ink-secondary">{a.label}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3 text-xs">
                  <span className="num-col w-10 text-right text-ink-muted">{share.toFixed(0)}%</span>
                  <span className={`num-col w-24 text-right text-sm ${balance < 0 ? 'text-critical-text' : 'text-ink'}`}>
                    {formatMoney(balance)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
