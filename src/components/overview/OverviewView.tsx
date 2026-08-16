import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useVisibleEvents, useStore } from '../../lib/store';
import { foldTrades, foldDividends, investmentSummary, positionsFrom } from '../../lib/investments';
import { foldHoldings, foldBudgets } from '../../lib/entities';
import { foldAccounts } from '../../lib/accounts';
import { foldDebts, totalOwed } from '../../lib/debt';
import {
  totalBalance,
  totalOutflowForMonth,
  totalIncomeForMonth,
  monthKey,
  previousMonthKey,
  monthsWithActivity,
  endOfMonth,
} from '../../lib/derive';
import { Card, SectionTitle, EmptyState } from '../ui/primitives';
import { ChartCard, DrillHint } from '../ui/ChartCard';
import {
  netWorthTable,
  incomeVsExpensesTable,
  spendByCategoryTable,
  categoryChangeTable,
  spendOverTimeTable,
  savingsRateTable,
  budgetsTable,
} from '../../lib/chartTables';
import { formatMoney, monthLabel } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Reveal } from '../ui/Reveal';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { MonthFilter } from './MonthFilter';
import { TimeTravel, TimeTravelBanner } from './TimeTravel';
import { RunwayChart, RunwaySummary } from './RunwayChart';
import { PortfolioCard } from './PortfolioCard';
import { AccountsCard } from './AccountsCard';
import { NetWorthChart } from './NetWorthChart';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { SpendByCategoryPie } from './SpendByCategoryPie';
import { BudgetMeter } from './BudgetMeter';
import { CategoryDumbbell } from './CategoryDumbbell';
import { BudgetProgress } from './BudgetProgress';
import { SavingsRateChart } from './SavingsRateChart';
import { Anomalies } from './Anomalies';
import { forecastMonth, sameMonthLastYear } from '../../lib/analysis';

function Delta({ delta, goodWhen, period = 'last month' }: { delta?: number; goodWhen: 'up' | 'down'; period?: string }) {
  if (delta === undefined || delta === 0) {
    return <p className="t-caption mt-1.5">No change vs {period}</p>;
  }
  const isGood = goodWhen === 'up' ? delta > 0 : delta < 0;
  return (
    // `money` marks it for privacy mode: it carries a figure without using the
    // numeric or metric type classes the blur otherwise keys off.
    <p className={`money mt-1.5 flex items-center gap-1 text-xs font-medium ${isGood ? 'text-positive' : 'text-complement'}`}>
      {/* Direction is an arrow as well as a colour — the sign never rides on hue alone. */}
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${delta > 0 ? '' : 'rotate-180'}`} fill="currentColor" aria-hidden="true">
        <path d="M6 2.2 10 7H2l4-4.8Z" />
      </svg>
      {formatMoney(Math.abs(delta))} vs {period}
    </p>
  );
}

/** Stat tile contract: label, value, then an optional delta or supporting line.
 * Proportional figures on the value — tabular-nums makes big numbers look loose. */
function StatTile({
  label,
  value,
  tone = 'ink',
  onDrill,
  drillLabel,
  children,
}: {
  label: string;
  value: number;
  tone?: 'ink' | 'critical';
  onDrill?: () => void;
  drillLabel?: string;
  children?: ReactNode;
}) {
  const toneClass = tone === 'critical' ? 'text-critical-text' : 'text-ink';
  return (
    <Card>
      <p className="t-label">{label}</p>
      {onDrill ? (
        <button
          type="button"
          onClick={onDrill}
          aria-label={drillLabel}
          className={`t-metric mt-1 cursor-pointer rounded-md transition-colors hover:text-accent ${toneClass}`}
        >
          <AnimatedNumber value={value} format={formatMoney} />
        </button>
      ) : (
        <p className={`t-metric mt-1 ${toneClass}`}>
          <AnimatedNumber value={value} format={formatMoney} />
        </p>
      )}
      {children}
    </Card>
  );
}

export function OverviewView() {
  // Everything on this page reads the ledger through this one list, so a date
  // set in the time-travel control reaches the hero, the tiles and every chart
  // without any of them knowing the feature exists.
  const events = useVisibleEvents();
  const quotes = useStore((s) => s.quotes);
  const openDrill = useStore((s) => s.openDrill);
  const accountCount = useMemo(() => foldAccounts(events).length, [events]);
  // Live prices are applied here too. Building positions inline for time travel
  // and forgetting the overlay is exactly how the hero ended up pricing a
  // live-quoted portfolio at cost.
  const positions = useMemo(() => positionsFrom(events, foldHoldings(events), quotes), [events, quotes]);
  const debts = useMemo(() => foldDebts(events), [events]);
  const budgets = useMemo(() => foldBudgets(events), [events]);
  const heroRef = useRef<HTMLParagraphElement>(null);

  const currentMonth = monthKey(new Date().toISOString());
  const monthsActive = useMemo(() => monthsWithActivity(events), [events]);
  const availableMonths = monthsActive.includes(currentMonth) ? monthsActive : [...monthsActive, currentMonth].sort();
  const [month, setMonth] = useState(currentMonth);

  const balance = useMemo(() => totalBalance(events), [events]);
  const balanceDelta = useMemo(() => {
    if (monthsActive.length < 2) return undefined;
    return balance - totalBalance(events, endOfMonth(previousMonthKey(currentMonth)));
  }, [balance, events, monthsActive.length, currentMonth]);

  const income = useMemo(() => totalIncomeForMonth(events, month), [events, month]);
  const spend = useMemo(() => totalOutflowForMonth(events, month), [events, month]);
  const spendDelta = useMemo(() => {
    if (monthsActive.length < 2) return undefined;
    return spend - totalOutflowForMonth(events, previousMonthKey(month));
  }, [spend, events, monthsActive.length, month]);
  const saved = income - spend;

  const forecast = useMemo(() => forecastMonth(events, month), [events, month]);
  // Only offered when the same month a year ago actually has data; a delta
  // against an empty month would read as a 100% drop rather than "no data".
  const lastYearMonth = sameMonthLastYear(month);
  const lastYearSpend = useMemo(() => totalOutflowForMonth(events, lastYearMonth), [events, lastYearMonth]);
  const seasonalDelta = lastYearSpend > 0 ? spend - lastYearSpend : undefined;

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

      <div>
        <SectionTitle action={<MonthFilter month={month} months={availableMonths} onChange={setMonth} />}>
          Monthly snapshot
        </SectionTitle>

        {/* Headline numbers are stat tiles and a meter — not charts. A ratio
            against a limit is a meter; a lone value is a tile. */}
        <Reveal key={`kpi-${month}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" from="start" stagger={0.05}>
          <Card className="xl:col-span-2">
            <BudgetMeter month={month} />
          </Card>
          <StatTile
            label="Saved this month"
            value={saved}
            tone={saved < 0 ? 'critical' : 'ink'}
            drillLabel="Show what makes up this month"
            onDrill={() => openDrill({ title: monthLabel(month), subtitle: 'Everything in and out', filter: { month } })}
          >
            <p className="t-caption mt-1.5">
              <span className="num-col text-ink-secondary">{formatMoney(income)}</span> in ·{' '}
              <span className="num-col text-ink-secondary">{formatMoney(spend)}</span> out
            </p>
          </StatTile>
          <StatTile
            label="Spent this month"
            value={spend}
            drillLabel="Show what makes up this month's spending"
            onDrill={() => openDrill({ title: `Spending in ${monthLabel(month)}`, subtitle: 'Every charge, newest first', filter: { month, type: 'expense' } })}
          >
            <Delta delta={spendDelta} goodWhen="down" />
            {seasonalDelta !== undefined && <Delta delta={seasonalDelta} goodWhen="down" period={monthLabel(lastYearMonth)} />}
          </StatTile>
        </Reveal>

        {forecast.daysRemaining > 0 && (
          <Reveal key={`forecast-${month}`} className="mt-3 grid grid-cols-1">
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <p className="t-label">Projected month end</p>
                  <p className="t-metric mt-1 text-ink">
                    <AnimatedNumber value={forecast.total} format={formatMoney} />
                  </p>
                </div>
                {/* The three parts have very different certainties, so they are
                    shown separately rather than hidden inside one number. */}
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <div>
                    <dt className="text-ink-muted">Already spent</dt>
                    <dd className="num-col text-ink-secondary">{formatMoney(forecast.actual)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Recurring still due</dt>
                    <dd className="num-col text-ink-secondary">{formatMoney(forecast.scheduled)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">At current pace</dt>
                    <dd className="num-col text-ink-secondary">{formatMoney(forecast.projected)}</dd>
                  </div>
                </dl>
              </div>
              <p className="t-caption mt-2">
                {forecast.daysRemaining} {forecast.daysRemaining === 1 ? 'day' : 'days'} left
                {!forecast.reliable && ' · too early in the month for the pace estimate to mean much'}
              </p>
            </Card>
          </Reveal>
        )}

        <Reveal key={`detail-${month}`} className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5" from="start" stagger={0.06}>
          <ChartCard
            title="Where it went"
            subtitle="Share of this month's spending"
            table={spendByCategoryTable(events, month)}
            className="xl:col-span-2"
          >
            <SpendByCategoryPie month={month} />
          </ChartCard>
          <ChartCard
            title="What changed"
            subtitle="Every category, last month to this"
            table={categoryChangeTable(events, month)}
            className="xl:col-span-3"
          >
            <CategoryDumbbell month={month} />
          </ChartCard>
        </Reveal>

        <Reveal key={`budgets-${month}`} className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2" from="start">
          <ChartCard title="Budgets" subtitle="Against this month's limits" table={budgetsTable(events, budgets, month)}>
            <BudgetProgress month={month} />
          </ChartCard>
          <ChartCard title="Worth a look" subtitle="Charges that are large for their category">
            <Anomalies month={month} />
          </ChartCard>
        </Reveal>
      </div>

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
