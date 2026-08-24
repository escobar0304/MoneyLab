import { useMemo, useState } from 'react';
import { useVisibleEvents, useStore } from '../../lib/store';
import { foldBudgets } from '../../lib/entities';
import { totalOutflowForMonth, totalIncomeForMonth, monthKey, monthsWithActivity, previousMonthKey } from '../../lib/derive';
import { forecastMonth, sameMonthLastYear } from '../../lib/analysis';
import { formatMoney, monthLabel } from '../../lib/format';
import { Card, SectionTitle } from '../ui/primitives';
import { ChartCard } from '../ui/ChartCard';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { StatTile, Delta } from '../ui/StatTile';
import { Reveal } from '../ui/Reveal';
import { spendByCategoryTable, categoryChangeTable, budgetsTable } from '../../lib/chartTables';
import { MonthFilter } from './MonthFilter';
import { BudgetMeter } from './BudgetMeter';
import { SpendByCategoryPie } from './SpendByCategoryPie';
import { CategoryDumbbell } from './CategoryDumbbell';
import { BudgetProgress } from './BudgetProgress';
import { Anomalies } from './Anomalies';

/**
 * The one month a reader is currently thinking about: how it's tracking against
 * budget, what changed since last month, and what's projected at month end.
 *
 * Split out of Overview so the page's headline (net worth, trends) and this
 * month-scoped detail don't compete for the same component's attention — the
 * month picker here only ever re-renders this block, not the whole dashboard.
 */
export function MonthlySnapshot() {
  const events = useVisibleEvents();
  const openDrill = useStore((s) => s.openDrill);
  const budgets = useMemo(() => foldBudgets(events), [events]);

  const currentMonth = monthKey(new Date().toISOString());
  const monthsActive = useMemo(() => monthsWithActivity(events), [events]);
  const availableMonths = monthsActive.includes(currentMonth) ? monthsActive : [...monthsActive, currentMonth].sort();
  const [month, setMonth] = useState(currentMonth);

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

  return (
    <div>
      <SectionTitle action={<MonthFilter month={month} months={availableMonths} onChange={setMonth} />}>Monthly snapshot</SectionTitle>

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
  );
}
