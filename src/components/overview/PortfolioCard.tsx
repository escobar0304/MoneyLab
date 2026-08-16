import { useMemo } from 'react';
import { usePortfolio, useStore } from '../../lib/store';
import { symbolColorMap, PRIMARY, COMPLEMENT } from '../../lib/chartTheme';
import { formatMoney, formatTime } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Card, EmptyState } from '../ui/primitives';

/** Signed money with the sign spelled out, so direction never rides on hue alone. */
function Signed({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <span className="num-col font-medium" style={{ color: value >= 0 ? PRIMARY : COMPLEMENT }}>
      {value >= 0 ? '+' : '−'}
      {formatMoney(Math.abs(value))}
      {suffix}
    </span>
  );
}

/** "XETR:VWCE" -> "VWCE". The exchange is noise once you own the thing. */
function ticker(symbol: string): string {
  return symbol.split(':').pop() ?? symbol;
}

/**
 * What the portfolio is worth, what it did today, and what it is made of.
 *
 * The allocation is one stacked bar rather than a bar chart per holding. Real
 * fund names run to eight words — "iShares S&P 500 Information Technology
 * Sector UCITS ETF" — and a categorical axis of those either collides into
 * itself or eats half the card. A single bar needs no axis at all: the widths
 * *are* the shares, and the list underneath carries the names once, in full.
 *
 * Colour identifies the holding and nothing else. It is assigned from the
 * sorted symbol list, so a price move never repaints the bar — which, with
 * prices refreshing every minute, would otherwise happen constantly.
 */
export function PortfolioCard() {
  const { positions, summary, dayChange, dayChangePct, delayed, liveCount } = usePortfolio();
  const quotes = useStore((s) => s.quotes);

  const colors = useMemo(() => symbolColorMap(positions.map((p) => p.holding.symbol)), [positions]);

  const rows = useMemo(
    () =>
      positions
        .filter((p) => p.quantity > 0 && p.value > 0)
        .map((p) => {
          const quote = quotes[p.holding.symbol.toUpperCase()];
          return {
            symbol: p.holding.symbol,
            ticker: ticker(p.holding.symbol),
            name: p.holding.label,
            value: p.value,
            share: summary.value > 0 ? (p.value / summary.value) * 100 : 0,
            day: quote ? Math.round(p.quantity * quote.baseChangeAbs * 100) / 100 : null,
          };
        })
        .sort((a, b) => b.value - a.value),
    [positions, quotes, summary.value]
  );

  if (positions.length === 0) {
    return (
      <Card>
        <p className="t-title text-ink">Portfolio</p>
        <div className="mt-3">
          <EmptyState title="Nothing held yet" description="Add a holding in Markets to see it here." />
        </div>
      </Card>
    );
  }

  const lastQuote = Object.values(quotes)[0]?.fetchedAt;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-title text-ink">Portfolio</p>
          <p className="t-caption mt-0.5">
            {liveCount > 0 ? (
              <>
                Live prices{delayed && ', 15 min delayed'}
                {lastQuote && ` · ${formatTime(lastQuote)}`}
              </>
            ) : (
              'Prices as you recorded them'
            )}
          </p>
        </div>
        {/* Today leads on the right: it is the only figure here that is new
            since the last look. */}
        {dayChange !== null && (
          <div className="text-right">
            <p className="text-xs text-ink-muted">Today</p>
            <p className="text-lg">
              <Signed value={dayChange} suffix={dayChangePct !== null ? ` (${dayChangePct.toFixed(2)}%)` : undefined} />
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-3xl font-semibold text-ink">
          <AnimatedNumber value={summary.value} format={formatMoney} />
        </p>
        {summary.returnPct !== null && (
          <p className="text-sm">
            <span className="text-xs text-ink-muted">all time </span>
            <Signed value={summary.totalReturn} suffix={` (${summary.returnPct.toFixed(1)}%)`} />
          </p>
        )}
      </div>

      {/* The allocation, as one bar. No axis, no labels, no collisions — the
          widths are the shares and the list below names them. */}
      <div
        className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Allocation: ${rows.map((r) => `${r.name} ${r.share.toFixed(0)}%`).join(', ')}`}
      >
        {rows.map((row) => (
          <span
            key={row.symbol}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${row.share}%`, backgroundColor: colors.get(row.symbol) }}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <li key={row.symbol} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors.get(row.symbol) }} />
              {/* Ticker first, at full strength: it is what identifies the
                  holding at a glance. The full name follows, quieter, and
                  truncates instead of wrapping into the numbers. */}
              <span className="shrink-0 font-medium text-ink">{row.ticker}</span>
              <span className="truncate text-xs text-ink-muted">{row.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-3 text-xs">
              <span className="num-col w-10 text-right text-ink-muted">{row.share.toFixed(1)}%</span>
              {row.day !== null && (
                <span className="w-16 text-right">
                  <Signed value={row.day} />
                </span>
              )}
              <span className="num-col w-20 text-right text-sm text-ink-secondary">{formatMoney(row.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
