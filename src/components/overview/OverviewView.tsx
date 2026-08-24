import { useMemo, useRef } from 'react';
import { useVisibleEvents, useStore } from '../../lib/store';
import { foldTrades, foldDividends, investmentSummary, positionsFrom } from '../../lib/investments';
import { foldHoldings } from '../../lib/entities';
import { foldAccounts } from '../../lib/accounts';
import { foldDebts, totalOwed } from '../../lib/debt';
import { totalBalance, monthKey, previousMonthKey, monthsWithActivity, endOfMonth } from '../../lib/derive';
import { Card, EmptyState } from '../ui/primitives';
import { ChartCard, DrillHint } from '../ui/ChartCard';
import { netWorthTable, incomeVsExpensesTable, spendOverTimeTable, savingsRateTable } from '../../lib/chartTables';
import { formatMoney } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Delta } from '../ui/StatTile';
import { Reveal } from '../ui/Reveal';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { TimeTravel, TimeTravelBanner } from './TimeTravel';
import { RunwayChart, RunwaySummary } from './RunwayChart';
import { PortfolioCard } from './PortfolioCard';
import { AccountsCard } from './AccountsCard';
import { NetWorthChart } from './NetWorthChart';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { SavingsRateChart } from './SavingsRateChart';
import { MonthlySnapshot } from './MonthlySnapshot';

export function OverviewView() {
  // Everything on this page reads the ledger through this one list, so a date
  // set in the time-travel control reaches the hero, the tiles and every chart
  // without any of them knowing the feature exists.
  const events = useVisibleEvents();
  const quotes = useStore((s) => s.quotes);
  const accountCount = useMemo(() => foldAccounts(events).length, [events]);
  // Live prices are applied here too. Building positions inline for time travel
  // and forgetting the overlay is exactly how the hero ended up pricing a
  // live-quoted portfolio at cost.
  const positions = useMemo(() => positionsFrom(events, foldHoldings(events), quotes), [events, quotes]);
  const debts = useMemo(() => foldDebts(events), [events]);
  const heroRef = useRef<HTMLParagraphElement>(null);

  const currentMonth = monthKey(new Date().toISOString());
  const monthsActive = useMemo(() => monthsWithActivity(events), [events]);

  const balance = useMemo(() => totalBalance(events), [events]);
  const balanceDelta = useMemo(() => {
    if (monthsActive.length < 2) return undefined;
    return balance - totalBalance(events, endOfMonth(previousMonthKey(currentMonth)));
  }, [balance, events, monthsActive.length, currentMonth]);

  // Net worth only differs from cash once something is actually held or owed,
  // so the hero stays a single honest number until there is something to add.
  const portfolio = useMemo(
    () => investmentSummary(positions, foldTrades(events), foldDividends(events)),
    [positions, events]
  );
  const owed = useMemo(() => totalOwed(debts), [debts]);
  // Assets minus liabilities. Counting the flat's deposit while ignoring the
  // mortgage against it is the single easiest way for this figure to lie.
  const netWorth = balance + portfolio.value - owed;
  const composed = positions.length > 0 || owed > 0;

  useGSAP(
    () => {
      if (prefersReducedMotion() || !heroRef.current) return;
      gsap.from(heroRef.current, { autoAlpha: 0, y: 10, duration: DUR.base, ease: EASE.out });
    },
    { dependencies: [] }
  );

  if (events.length === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="Head to Entries to set your salary and log your first expense — this page fills in automatically."
      />
    );
  }

  return (
    <div className="view-stack">
      <TimeTravelBanner />

      {/* The page's thesis, on one raised surface: where you stand, and where
          that is heading. These were two separate panels of equal weight, which
          is precisely how a dashboard ends up with fifteen cards and no answer —
          the eye had nowhere to land first. */}
      <Card level="primary">
        <p className="t-label">{composed ? 'Net worth' : 'Balance'}</p>
        <p ref={heroRef} className={`t-hero mt-1 ${netWorth < 0 ? 'text-critical-text' : 'text-ink'}`}>
          <AnimatedNumber value={netWorth} format={formatMoney} />
        </p>
        {composed ? (
          // The parts are spelled out because a single net figure hides which
          // side moved — a good month and a repriced portfolio look identical.
          <p className="t-caption mt-1.5">
            <span className="num-col text-ink-secondary">{formatMoney(balance)}</span> cash
            {positions.length > 0 && (
              <>
                {' · '}
                <span className="num-col text-ink-secondary">{formatMoney(portfolio.value)}</span> invested
                {portfolio.returnPct !== null && (
                  <>
                    {' '}
                    (
                    <span
                      className="num-col"
                      style={{ color: portfolio.totalReturn >= 0 ? 'var(--color-positive)' : 'var(--color-complement)' }}
                    >
                      {portfolio.totalReturn >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(portfolio.totalReturn))}
                    </span>
                    )
                  </>
                )}
              </>
            )}
            {owed > 0 && (
              <>
                {' · '}
                <span className="num-col text-complement">−{formatMoney(owed)}</span> owed
              </>
            )}
          </p>
        ) : (
          <Delta delta={balanceDelta} goodWhen="up" />
        )}

        {/* Directly under the figure, inside the same surface: "do I make it to
            payday" is the most immediate question on the page, and the one a
            month-end total cannot answer because it nets the order away. */}
        <div className="mt-4 border-t border-hairline pt-4">
          <p className="t-title text-ink">The next 60 days</p>
          <p className="t-caption mt-0.5">Balance day by day, if nothing changes</p>
          <div className="mt-3">
            <RunwaySummary />
          </div>
          <div className="mt-2">
            <RunwayChart />
          </div>
        </div>
      </Card>

      <DrillHint />

      {/* Where the money sits, and what it is invested in. Secondary weight:
          they qualify the headline figure rather than restating it. */}
      {(positions.length > 0 || accountCount > 1) && (
        // Two columns only when there are two panels; one panel in a two-column
        // grid is a card floating in half the page.
        <Reveal
          className={`grid grid-cols-1 gap-3 ${positions.length > 0 && accountCount > 1 ? 'lg:grid-cols-2' : ''}`}
          from="start"
        >
          {accountCount > 1 && <AccountsCard />}
          {positions.length > 0 && <PortfolioCard />}
        </Reveal>
      )}

      {/* Trends. One series over time is an area; two distinct series are lines.
          All three timeline charts share a crosshair through syncId. */}
      <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-3" from="start">
        <ChartCard title="Net worth over time" table={netWorthTable(events)} className="lg:col-span-2">
          <NetWorthChart />
        </ChartCard>
        <ChartCard title="Income vs. expenses" table={incomeVsExpensesTable(events)}>
          <IncomeVsExpensesChart />
        </ChartCard>
      </Reveal>

      <MonthlySnapshot />

      {/* Quiet: history worth having, not worth competing for attention. These
          two sat at the same weight as the headline panels, which is what made
          the page read as a uniform wall rather than as an argument. */}
      <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-2" from="start">
        <ChartCard title="Savings rate" subtitle="Share of income kept, per month" table={savingsRateTable(events)} level="quiet">
          <SavingsRateChart />
        </ChartCard>
        <ChartCard
          title="Spend by category over time"
          subtitle="Stacked to the monthly total"
          table={spendOverTimeTable(events)}
          level="quiet"
        >
          <SpendByCategoryChart />
        </ChartCard>
      </Reveal>

      {/* Time travel lives at the foot of the page, out of the way. It is
          something you go looking for once in a while, not a control that
          earns permanent space beside the headline figure. */}
      <TimeTravel />
    </div>
  );
}
