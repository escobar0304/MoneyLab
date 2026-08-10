import { useMemo, useState } from 'react';
import { useStore, useHoldings } from '../../lib/store';
import { useWatchlist } from '../../lib/watchlist';
import { portfolioSummary } from '../../lib/analysis';
import { formatMoney, formatDate } from '../../lib/format';
import { PRIMARY, COMPLEMENT } from '../../lib/chartTheme';
import { Button, Card, Input, Label, SectionTitle } from '../ui/primitives';
import type { Holding } from '../../lib/types';

interface Draft {
  symbol: string;
  label: string;
  quantity: string;
  avgCost: string;
  lastPrice: string;
}

const empty = (): Draft => ({ symbol: '', label: '', quantity: '', avgCost: '', lastPrice: '' });

function daysOld(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function HoldingRow({ holding }: { holding: Holding }) {
  const upsert = useStore((s) => s.upsertHolding);
  const remove = useStore((s) => s.removeHolding);
  const [price, setPrice] = useState(holding.lastPrice !== undefined ? String(holding.lastPrice) : '');

  const cost = holding.quantity * holding.avgCost;
  const value = holding.lastPrice !== undefined ? holding.quantity * holding.lastPrice : cost;
  const gain = value - cost;
  const priced = holding.lastPrice !== undefined;

  const savePrice = () => {
    const next = Number(price);
    if (!Number.isFinite(next) || next <= 0) return;
    if (next === holding.lastPrice) return;
    upsert({ ...holding, lastPrice: next, lastPriceAt: new Date().toISOString() });
  };

  return (
    <div className="rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {holding.label} <span className="text-ink-muted">{holding.symbol}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="num-col">{holding.quantity}</span> @ <span className="num-col">{formatMoney(holding.avgCost)}</span> ·
            cost <span className="num-col">{formatMoney(cost)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-32">
            <Label htmlFor={`price-${holding.id}`}>Price / unit</Label>
            <Input
              id={`price-${holding.id}`}
              type="number"
              min={0}
              step="any"
              value={price}
              placeholder="Not set"
              onChange={(e) => setPrice(e.target.value)}
              onBlur={savePrice}
              onKeyDown={(e) => e.key === 'Enter' && savePrice()}
            />
          </div>
          <Button variant="ghost" onClick={() => remove(holding.id)} aria-label={`Remove ${holding.label}`}>
            Remove
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-2 text-xs">
        <span className="text-ink-muted">
          {priced ? (
            <>
              Worth <span className="num-col text-ink-secondary">{formatMoney(value)}</span>
              {holding.lastPriceAt && ` · priced ${formatDate(holding.lastPriceAt)}`}
            </>
          ) : (
            'No price recorded — counted at cost'
          )}
        </span>
        {priced && (
          <span className="num-col font-medium" style={{ color: gain >= 0 ? PRIMARY : COMPLEMENT }}>
            {gain >= 0 ? '+' : '−'}
            {formatMoney(Math.abs(gain))}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What you actually own, as opposed to what you happen to be watching.
 *
 * Prices are entered by hand and stamped with the date. The TradingView panel is
 * a third-party iframe whose data the page cannot read, and any real quote feed
 * needs a keyed API — so rather than imply live valuation, the figure states how
 * old the price behind it is.
 */
export function HoldingsManager() {
  const holdings = useHoldings();
  const upsert = useStore((s) => s.upsertHolding);
  const { symbols } = useWatchlist();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

  const summary = useMemo(() => portfolioSummary(holdings), [holdings]);
  const valid = draft.symbol.trim() !== '' && Number(draft.quantity) > 0 && Number(draft.avgCost) > 0;

  const create = () => {
    if (!valid) return;
    const price = Number(draft.lastPrice);
    upsert({
      symbol: draft.symbol.trim().toUpperCase(),
      label: draft.label.trim() || draft.symbol.trim().split(':').pop() || draft.symbol.trim(),
      quantity: Number(draft.quantity),
      avgCost: Number(draft.avgCost),
      ...(Number.isFinite(price) && price > 0 ? { lastPrice: price, lastPriceAt: new Date().toISOString() } : {}),
    });
    setDraft(empty());
    setAdding(false);
  };

  return (
    <Card>
      <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add holding'}</Button>}>
        Portfolio
      </SectionTitle>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <p className="text-xs text-ink-muted">Value</p>
          <p className="text-2xl font-semibold text-ink">{formatMoney(summary.value)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Cost</p>
          <p className="num-col text-sm text-ink-secondary">{formatMoney(summary.cost)}</p>
        </div>
        {summary.gainPct !== null && (
          <div>
            <p className="text-xs text-ink-muted">Gain</p>
            <p className="num-col text-sm font-medium" style={{ color: summary.gain >= 0 ? PRIMARY : COMPLEMENT }}>
              {summary.gain >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(summary.gain))} ({summary.gainPct.toFixed(1)}%)
            </p>
          </div>
        )}
      </div>

      {(summary.unpriced > 0 || (summary.stalestPriceAt && daysOld(summary.stalestPriceAt) >= 7)) && (
        <p className="mb-3 text-xs text-ink-muted">
          {summary.unpriced > 0 && `${summary.unpriced} holding${summary.unpriced === 1 ? '' : 's'} with no price, counted at cost. `}
          {summary.stalestPriceAt && daysOld(summary.stalestPriceAt) >= 7 && `Oldest price is ${daysOld(summary.stalestPriceAt)} days old.`}
        </p>
      )}

      {adding && (
        <div className="mb-3 rounded-lg border border-border bg-surface-0 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="h-symbol">Symbol</Label>
              <Input
                id="h-symbol"
                list="watchlist-symbols"
                value={draft.symbol}
                onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
                placeholder="BINANCE:BTCEUR"
                autoFocus
              />
              <datalist id="watchlist-symbols">
                {symbols.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="h-label">Name (optional)</Label>
              <Input id="h-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Bitcoin" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="h-qty">Quantity</Label>
              <Input
                id="h-qty"
                type="number"
                min={0}
                step="any"
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                placeholder="0.25"
              />
            </div>
            <div>
              <Label htmlFor="h-cost">Average cost / unit</Label>
              <Input
                id="h-cost"
                type="number"
                min={0}
                step="any"
                value={draft.avgCost}
                onChange={(e) => setDraft({ ...draft, avgCost: e.target.value })}
                placeholder="42000"
              />
            </div>
            <div>
              <Label htmlFor="h-price">Price now (optional)</Label>
              <Input
                id="h-price"
                type="number"
                min={0}
                step="any"
                value={draft.lastPrice}
                onChange={(e) => setDraft({ ...draft, lastPrice: e.target.value })}
                placeholder="58000"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={create} disabled={!valid}>
              Add holding
            </Button>
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">
          Nothing recorded yet. Add what you own to make Net worth mean more than cash in the account.
        </p>
      ) : (
        <div className="space-y-2">
          {holdings.map((h) => (
            <HoldingRow key={h.id} holding={h} />
          ))}
        </div>
      )}
    </Card>
  );
}
