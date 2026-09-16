import { useMemo, useState } from 'react';
import { useStore } from '../../lib/core/store';
import { closedLots, capitalGainsByYear, capitalGainsToCsv } from '../../lib/investments/capitalGains';
import { formatMoney, formatDate } from '../../lib/core/format';
import { PRIMARY, COMPLEMENT } from '../../lib/insight/chartTheme';
import { Card, SectionTitle, Select, Button, Badge } from '../ui/primitives';

const YEAR_DAYS = 365;

function Signed({ value }: { value: number }) {
  return (
    <span className="num-col font-medium" style={{ color: value >= 0 ? PRIMARY : COMPLEMENT }}>
      {value >= 0 ? '+' : '−'}
      {formatMoney(Math.abs(value))}
    </span>
  );
}

/**
 * What was actually realised by selling, year by year — the report a return
 * needs, not the average-cost figure the rest of Portfolio shows.
 *
 * Matched FIFO on purpose: "was this lot held over a year" is a question
 * about one specific batch of units, which average cost has already blended
 * away by the time a position is shown above. This is a second, independent
 * pass over the same trade log for that one question — see capitalGains.ts.
 *
 * Renders nothing until something has actually been sold; a report with
 * every row reading zero would just be noise on a page most sessions never
 * need this on.
 */
export function CapitalGainsPanel() {
  const events = useStore((s) => s.events);
  const allLots = useMemo(() => closedLots(events), [events]);

  const years = useMemo(() => {
    const set = new Set(allLots.map((l) => Number(l.disposedAt.slice(0, 4))));
    return Array.from(set).sort((a, b) => b - a);
  }, [allLots]);

  const [year, setYear] = useState(() => years[0] ?? new Date().getFullYear());
  const data = useMemo(() => capitalGainsByYear(events, year), [events, year]);

  const exportForAccountant = () => {
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + capitalGainsToCsv(data)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneylab-capital-gains-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (allLots.length === 0) return null;

  return (
    <Card>
      <SectionTitle
        action={
          <div className="flex items-center gap-2">
            <div className="w-28">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" onClick={exportForAccountant} disabled={data.lots.length === 0}>
              Export for accountant
            </Button>
          </div>
        }
      >
        Capital gains
      </SectionTitle>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <p className="t-label">Net {year}</p>
          <p className="t-metric" style={{ color: data.netGain >= 0 ? 'var(--color-positive)' : 'var(--color-complement)' }}>
            {data.netGain >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(data.netGain))}
          </p>
        </div>
        <div>
          <p className="t-label">Gains</p>
          <p className="num-col text-sm text-ink-secondary">{formatMoney(data.gain)}</p>
        </div>
        <div>
          <p className="t-label">Losses</p>
          <p className="num-col text-sm text-ink-secondary">{formatMoney(data.loss)}</p>
        </div>
      </div>

      {data.lots.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing sold in {year}.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.lots.map((lot, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-hairline px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-ink">{lot.symbol}</span>
                <span className="num-col text-xs text-ink-muted">{lot.quantity}</span>
                <Badge tone={lot.holdingDays > YEAR_DAYS ? 'good' : 'neutral'}>
                  {lot.holdingDays > YEAR_DAYS ? 'held over a year' : `${lot.holdingDays} days held`}
                </Badge>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-ink-muted">
                <span>
                  {formatDate(lot.acquiredAt)} → {formatDate(lot.disposedAt)}
                </span>
                <Signed value={lot.gain} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Said once, plainly — the same posture as the IRS panel's own
          disclaimer, and for the same reason: getting this wrong in the
          user's favour would be worse than not showing it. */}
      <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-muted">
        Securities and funds are taxed at a flat rate in Portugal regardless of how long they were held; crypto-assets held over
        365 days are currently exempt from this tax, under 365 days taxed the same as everything else. This file has no reliable
        way to tell a stock from a crypto-asset by its symbol alone, so "days held" is left for you to apply that split by hand.
        Matched oldest-lot-first, which can differ slightly from the average-cost figures shown against each position above for a
        holding sold in stages — this is an estimate from what you logged, not an official simulation.
      </p>
    </Card>
  );
}
