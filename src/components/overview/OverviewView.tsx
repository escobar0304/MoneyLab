import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../lib/store';
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
import { formatMoney } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Reveal } from '../ui/Reveal';
import { gsap, useGSAP, EASE, DUR, prefersReducedMotion } from '../../lib/animation';
import { MonthFilter } from './MonthFilter';
import { NetWorthChart } from './NetWorthChart';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';
import { SpendByCategoryChart } from './SpendByCategoryChart';
import { SpendByCategoryPie } from './SpendByCategoryPie';
import { BudgetMeter } from './BudgetMeter';
import { CategoryDumbbell } from './CategoryDumbbell';

function Delta({ delta, goodWhen, period = 'last month' }: { delta?: number; goodWhen: 'up' | 'down'; period?: string }) {
  if (delta === undefined || delta === 0) {
    return <p className="mt-1.5 text-xs text-ink-muted">No change vs {period}</p>;
  }
  const isGood = goodWhen === 'up' ? delta > 0 : delta < 0;
  return (
    <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${isGood ? 'text-positive' : 'text-complement'}`}>
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
  children,
}: {
  label: string;
  value: number;
  tone?: 'ink' | 'critical';
  children?: ReactNode;
}) {
  return (
    <Card>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === 'critical' ? 'text-critical-text' : 'text-ink'}`}>
        <AnimatedNumber value={value} format={formatMoney} />
      </p>
      {children}
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

export function OverviewView() {
  const events = useStore((s) => s.events);
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
    <div className="space-y-6">
      {/* Hero figure — exactly one per view, and the only number at this size. */}
      <div>
        <p className="text-xs font-medium text-ink-muted">Balance</p>
        <p ref={heroRef} className="mt-1 text-5xl font-semibold tracking-tight text-ink">
          <AnimatedNumber value={balance} format={formatMoney} />
        </p>
        <Delta delta={balanceDelta} goodWhen="up" />
      </div>

      {/* Trends. One series over time is an area; two distinct series are lines.
          All three timeline charts share a crosshair through syncId. */}
      <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-3" from="start">
        <ChartCard title="Net worth over time" className="lg:col-span-2">
          <NetWorthChart />
        </ChartCard>
        <ChartCard title="Income vs. expenses">
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
          <StatTile label="Saved this month" value={saved} tone={saved < 0 ? 'critical' : 'ink'}>
            <p className="mt-1.5 text-xs text-ink-muted">
              <span className="num-col text-ink-secondary">{formatMoney(income)}</span> in ·{' '}
              <span className="num-col text-ink-secondary">{formatMoney(spend)}</span> out
            </p>
          </StatTile>
          <StatTile label="Spent this month" value={spend}>
            <Delta delta={spendDelta} goodWhen="down" />
          </StatTile>
        </Reveal>

        <Reveal key={`detail-${month}`} className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-5" from="start" stagger={0.06}>
          <ChartCard title="Where it went" subtitle="Share of this month's spending" className="xl:col-span-2">
            <SpendByCategoryPie month={month} />
          </ChartCard>
          <ChartCard title="What changed" subtitle="Every category, last month to this" className="xl:col-span-3">
            <CategoryDumbbell month={month} />
          </ChartCard>
        </Reveal>
      </div>

      <Reveal className="grid grid-cols-1">
        <ChartCard title="Spend by category over time" subtitle="Stacked to the monthly total">
          <SpendByCategoryChart />
        </ChartCard>
      </Reveal>
    </div>
  );
}
