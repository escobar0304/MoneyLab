import { useMemo, useRef, useState } from 'react';
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
import { CategoryBullets } from './CategoryBullets';

function Delta({ delta, goodWhen, period = 'last month' }: { delta?: number; goodWhen: 'up' | 'down'; period?: string }) {
  if (delta === undefined || delta === 0) {
    return <p className="mt-1.5 text-xs text-neutral-500">No change vs {period}</p>;
  }
  const isGood = goodWhen === 'up' ? delta > 0 : delta < 0;
  return (
    <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
      {/* Direction is an arrow as well as a colour — the sign never rides on hue alone. */}
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${delta > 0 ? '' : 'rotate-180'}`} fill="currentColor" aria-hidden="true">
        <path d="M6 2.2 10 7H2l4-4.8Z" />
      </svg>
      {formatMoney(Math.abs(delta))} vs {period}
    </p>
  );
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-neutral-500">{children}</p>;
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

  // The hero figure gets its own entrance ahead of the grid — it is the one
  // number the page leads with, so it lands first and everything else follows.
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
      {/* Hero — exactly one per view. */}
      <div>
        <TileLabel>Balance</TileLabel>
        <p ref={heroRef} className="mt-1 text-5xl font-semibold tracking-tight text-neutral-100">
          <AnimatedNumber value={balance} format={formatMoney} />
        </p>
        <Delta delta={balanceDelta} goodWhen="up" />
      </div>

      {/* Trend charts share a synced crosshair: hovering any one of them
          highlights the same month on the other two. */}
      <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-3" from="start">
        <Card className="lg:col-span-2">
          <p className="mb-3 text-sm font-semibold text-neutral-100">Net worth over time</p>
          <NetWorthChart />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-neutral-100">Income vs. expenses</p>
          <IncomeVsExpensesChart />
        </Card>
      </Reveal>

      <div>
        <SectionTitle action={<MonthFilter month={month} months={availableMonths} onChange={setMonth} />}>
          Monthly snapshot
        </SectionTitle>

        {/* Bento: the meter and the category ranking get the width they need,
            the two small figures pack into the remaining column. */}
        <Reveal key={month} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" from="center" stagger={0.06}>
          <Card className="xl:col-span-2">
            <BudgetMeter month={month} />
          </Card>
          <Card>
            <TileLabel>Saved this month</TileLabel>
            <p className={`mt-1 text-3xl font-semibold ${saved < 0 ? 'text-red-400' : 'text-neutral-100'}`}>
              <AnimatedNumber value={saved} format={formatMoney} />
            </p>
            <p className="mt-1.5 text-xs text-neutral-500">
              <span className="num-col text-neutral-300">{formatMoney(income)}</span> in ·{' '}
              <span className="num-col text-neutral-300">{formatMoney(spend)}</span> out
            </p>
          </Card>
          <Card>
            <TileLabel>Spent this month</TileLabel>
            <p className="mt-1 text-3xl font-semibold text-neutral-100">
              <AnimatedNumber value={spend} format={formatMoney} />
            </p>
            <Delta delta={spendDelta} goodWhen="down" />
          </Card>
          <Card className="md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-neutral-100">Where it went</p>
            <SpendByCategoryPie month={month} />
          </Card>
          <Card className="md:col-span-2">
            <p className="mb-1 text-sm font-semibold text-neutral-100">Category vs. last month</p>
            <p className="mb-3 text-xs text-neutral-500">Ranked by this month's spend</p>
            <CategoryBullets month={month} />
          </Card>
        </Reveal>
      </div>

      <Reveal className="grid grid-cols-1 gap-3">
        <Card>
          <p className="mb-3 text-sm font-semibold text-neutral-100">Spend by category over time</p>
          <SpendByCategoryChart />
        </Card>
      </Reveal>
    </div>
  );
}
