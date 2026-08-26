import type { ReactNode } from 'react';
import { formatMoney } from '../../lib/core/format';
import { Card } from './primitives';
import { AnimatedNumber } from './AnimatedNumber';

export function Delta({ delta, goodWhen, period = 'last month' }: { delta?: number; goodWhen: 'up' | 'down'; period?: string }) {
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
export function StatTile({
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
