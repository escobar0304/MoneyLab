import { useMemo, useState } from 'react';
import { useStore, usePortfolio } from '../../lib/store';
import { foldTrades, foldDividends, type Position } from '../../lib/investments';
import { useLivePrices } from '../../lib/useLiveQuotes';
import { formatMoney, formatDate, formatTime, todayInputValue } from '../../lib/format';
import { PRIMARY, COMPLEMENT } from '../../lib/chartTheme';
import { Button, Card, Input, Label, SectionTitle, Badge, EmptyState } from '../ui/primitives';
import { SymbolPicker } from '../ui/SymbolPicker';

function daysOld(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Gains are the one place colour carries meaning, so the sign is spelled out
 * as well — a reader who cannot separate the two hues still gets the direction. */
function Signed({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <span className="num-col font-medium" style={{ color: value >= 0 ? PRIMARY : COMPLEMENT }}>
      {value >= 0 ? '+' : '−'}
      {formatMoney(Math.abs(value))}
      {suffix}
    </span>
  );
}

interface TradeDraft {
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fees: string;
  date: string;
}

const emptyTrade = (): TradeDraft => ({ side: 'buy', quantity: '', price: '', fees: '', date: todayInputValue() });

/** The trade and dividend log for one holding, plus the forms that add to it. */
function PositionDetail({ position }: { position: Position }) {
  const events = useStore((s) => s.events);
  const addTrade = useStore((s) => s.addTrade);
  const addDividend = useStore((s) => s.addDividend);
  const removeEvent = useStore((s) => s.removeInvestmentEvent);

  const [trade, setTrade] = useState<TradeDraft>(emptyTrade());
  const [dividend, setDividend] = useState({ amount: '', date: todayInputValue(), asIncome: false });

  const log = useMemo(() => {
    const trades = foldTrades(events).filter((t) => t.holdingId === position.holding.id);
    const dividends = foldDividends(events).filter((d) => d.holdingId === position.holding.id);
    return [...trades, ...dividends].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [events, position.holding.id]);

  const quantity = Number(trade.quantity);
  const price = Number(trade.price);
  const tradeValid =
    quantity > 0 && price > 0 && (trade.side === 'buy' || quantity <= position.quantity || position.tradeCount === 0);
  const overselling = trade.side === 'sell' && quantity > position.quantity && position.tradeCount > 0;

  const submitTrade = () => {
    if (!tradeValid) return;
    addTrade({
      holdingId: position.holding.id,
      side: trade.side,
      quantity,
      price,
      fees: Number(trade.fees) > 0 ? Number(trade.fees) : undefined,
      date: new Date(trade.date).toISOString(),
    });
    setTrade(emptyTrade());
  };

  const submitDividend = () => {
    const amount = Number(dividend.amount);
    if (!(amount > 0)) return;
    addDividend({
      holdingId: position.holding.id,
      amount,
      date: new Date(dividend.date).toISOString(),
      alsoLogAsIncome: dividend.asIncome,
      label: `Dividend · ${position.holding.label}`,
    });
    setDividend({ amount: '', date: todayInputValue(), asIncome: false });
  };

  return (
    <div className="mt-3 space-y-3 border-t border-hairline pt-3">
      {position.tradeCount === 0 && position.quantity > 0 && (
        <p className="rounded-lg border border-hairline bg-surface-0 p-2.5 text-xs text-ink-muted">
          This position was entered by hand. Logging a trade switches it to the trade log — the{' '}
          <span className="num-col text-ink-secondary">{position.quantity}</span> units already recorded become an opening
          purchase at <span className="num-col text-ink-secondary">{formatMoney(position.avgCost)}</span>, so nothing is lost.
        </p>
      )}

      <div className="rounded-lg border border-hairline bg-surface-0 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Log a trade</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <Label htmlFor={`side-${position.holding.id}`}>Side</Label>
            <div className="flex rounded-md border border-border bg-surface-0 p-0.5" role="group" aria-label="Trade side">
              {(['buy', 'sell'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setTrade({ ...trade, side })}
                  aria-pressed={trade.side === side}
                  className={`flex-1 cursor-pointer rounded px-2 py-1 text-xs font-medium capitalize transition-colors duration-200 ${
                    trade.side === side ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink-secondary'
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor={`qty-${position.holding.id}`}>Quantity</Label>
            <Input
              id={`qty-${position.holding.id}`}
              type="number"
              min={0}
              step="any"
              value={trade.quantity}
              onChange={(e) => setTrade({ ...trade, quantity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`px-${position.holding.id}`}>Price / unit</Label>
            <Input
              id={`px-${position.holding.id}`}
              type="number"
              min={0}
              step="any"
              value={trade.price}
              onChange={(e) => setTrade({ ...trade, price: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`fee-${position.holding.id}`}>Fees</Label>
            <Input
              id={`fee-${position.holding.id}`}
              type="number"
              min={0}
              step="any"
              value={trade.fees}
              onChange={(e) => setTrade({ ...trade, fees: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor={`date-${position.holding.id}`}>Date</Label>
            <Input
              id={`date-${position.holding.id}`}
              type="date"
              max={todayInputValue()}
              value={trade.date}
              onChange={(e) => setTrade({ ...trade, date: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {overselling ? (
              <span className="text-critical-text">Only {position.quantity} units are held.</span>
            ) : quantity > 0 && price > 0 ? (
              <>
                {trade.side === 'buy' ? 'Costs' : 'Returns'}{' '}
                <span className="num-col text-ink-secondary">
                  {formatMoney(quantity * price + (trade.side === 'buy' ? 1 : -1) * (Number(trade.fees) || 0))}
                </span>
              </>
            ) : (
              'Buying does not deduct from your balance — see the note below.'
            )}
          </p>
          <Button onClick={submitTrade} disabled={!tradeValid}>
            Add trade
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-surface-0 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Record a dividend</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label htmlFor={`div-${position.holding.id}`}>Amount</Label>
            <Input
              id={`div-${position.holding.id}`}
              type="number"
              min={0}
              step="0.01"
              value={dividend.amount}
              onChange={(e) => setDividend({ ...dividend, amount: e.target.value })}
            />
          </div>
          <div className="w-40">
            <Label htmlFor={`divdate-${position.holding.id}`}>Date</Label>
            <Input
              id={`divdate-${position.holding.id}`}
              type="date"
              max={todayInputValue()}
              value={dividend.date}
              onChange={(e) => setDividend({ ...dividend, date: e.target.value })}
            />
          </div>
          {/* Accumulating funds never pay out, and a broker may reinvest
              automatically — so whether this was spendable cash is the user's
              call, not something to infer. */}
          <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={dividend.asIncome}
              onChange={(e) => setDividend({ ...dividend, asIncome: e.target.checked })}
              className="accent-accent"
            />
            Also log as income
          </label>
          <Button variant="secondary" onClick={submitDividend} disabled={!(Number(dividend.amount) > 0)}>
            Add
          </Button>
        </div>
      </div>

      {log.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">History</p>
          <ul className="space-y-1">
            {log.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-xs hover:bg-surface-2">
                <span className="text-ink-secondary">
                  <span className="text-ink-muted">{formatDate(entry.timestamp)}</span>{' '}
                  {entry.type === 'trade' ? (
                    <>
                      <span className="capitalize">{entry.side}</span> <span className="num-col">{entry.quantity}</span> @{' '}
                      <span className="num-col">{formatMoney(entry.price)}</span>
                      {entry.fees ? <span className="text-ink-muted"> · {formatMoney(entry.fees)} fees</span> : null}
                    </>
                  ) : (
                    <>
                      Dividend <span className="num-col">{formatMoney(entry.amount)}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeEvent(entry.id)}
                  aria-label="Delete this entry"
                  className="cursor-pointer text-ink-muted opacity-0 transition-opacity duration-200 hover:text-critical-text focus-visible:opacity-100 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const upsert = useStore((s) => s.upsertHolding);
  const remove = useStore((s) => s.removeHolding);
  const quote = useStore((s) => s.quotes[position.holding.symbol.toUpperCase()]);
  const [price, setPrice] = useState(position.holding.lastPrice !== undefined ? String(position.holding.lastPrice) : '');
  const [open, setOpen] = useState(false);

  const { holding } = position;
  const dayChange = quote ? Math.round(position.quantity * quote.baseChangeAbs * 100) / 100 : null;

  const savePrice = () => {
    const next = Number(price);
    if (!Number.isFinite(next) || next <= 0 || next === holding.lastPrice) return;
    upsert({ ...holding, lastPrice: next, lastPriceAt: new Date().toISOString() });
  };

  return (
    <div className="group rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {holding.label} <span className="text-ink-muted">{holding.symbol}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="num-col">{position.quantity}</span> @ <span className="num-col">{formatMoney(position.avgCost)}</span> ·
            cost <span className="num-col">{formatMoney(position.cost)}</span>
            {position.tradeCount > 0 && ` · ${position.tradeCount} trade${position.tradeCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* With a live quote the manual field is not just unnecessary, it is
              misleading — anything typed there is overwritten within a minute. */}
          {quote ? (
            <div className="text-right">
              <p className="text-xs text-ink-muted">Price / unit</p>
              <p className="num-col text-sm text-ink">
                {formatMoney(quote.basePrice)}{' '}
                <span style={{ color: quote.changePct >= 0 ? PRIMARY : COMPLEMENT }}>
                  {quote.changePct >= 0 ? '+' : '−'}
                  {Math.abs(quote.changePct).toFixed(2)}%
                </span>
              </p>
            </div>
          ) : (
            <div className="w-28">
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
          )}
          <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Trades'}
          </Button>
          <Button variant="ghost" onClick={() => remove(holding.id)} aria-label={`Remove ${holding.label}`}>
            Remove
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-2 text-xs">
        <span className="text-ink-muted">
          {quote ? (
            <>
              Worth <span className="num-col text-ink-secondary">{formatMoney(position.value)}</span>
              {quote.currency !== 'EUR' && (
                <>
                  {' '}
                  · quoted {quote.price.toFixed(2)} {quote.currency}
                </>
              )}
              {dayChange !== null && dayChange !== 0 && (
                <>
                  {' · today '}
                  <Signed value={dayChange} />
                </>
              )}
            </>
          ) : position.priced ? (
            <>
              Worth <span className="num-col text-ink-secondary">{formatMoney(position.value)}</span>
              {holding.lastPriceAt && ` · priced ${formatDate(holding.lastPriceAt)}`}
            </>
          ) : (
            'No price recorded — counted at cost'
          )}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-3">
          {position.dividends > 0 && (
            <span className="text-ink-muted">
              dividends <span className="num-col text-ink-secondary">{formatMoney(position.dividends)}</span>
            </span>
          )}
          {position.realized !== 0 && (
            <span className="text-ink-muted">
              realised <Signed value={position.realized} />
            </span>
          )}
          {position.irr !== null && (
            <Badge tone={position.irr >= 0 ? 'good' : 'bad'}>{(position.irr * 100).toFixed(1)}% a year</Badge>
          )}
          {position.priced && <Signed value={position.unrealized} />}
        </span>
      </div>

      {open && <PositionDetail position={position} />}
    </div>
  );
}

interface Draft {
  symbol: string;
  label: string;
  quantity: string;
  avgCost: string;
  lastPrice: string;
}

const empty = (): Draft => ({ symbol: '', label: '', quantity: '', avgCost: '', lastPrice: '' });

/**
 * What you actually own, as opposed to what you happen to be watching.
 *
 * Prices are entered by hand and stamped with the date. The TradingView panel is
 * a third-party iframe whose data the page cannot read, and any real quote feed
 * needs a keyed API — so rather than imply live valuation, the figure states how
 * old the price behind it is.
 *
 * Buying does not debit the cash balance. With one undivided pot there is no
 * brokerage account to move money out of, and deducting it would make Net worth
 * count the same euros twice — so the portfolio sits alongside the ledger rather
 * than inside it.
 */
export function HoldingsManager() {
  const { positions, summary, dayChange, dayChangePct, delayed, liveCount } = usePortfolio();
  const upsert = useStore((s) => s.upsertHolding);
  const live = useLivePrices();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty());

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
          <p className="t-metric text-ink">{formatMoney(summary.value)}</p>
        </div>
        {/* Today first among the derived figures: it is the only one that is new
            since the last time this page was open. */}
        {dayChange !== null && (
          <div>
            <p className="text-xs text-ink-muted">Today</p>
            <p className="text-sm">
              <Signed value={dayChange} suffix={dayChangePct !== null ? ` (${dayChangePct.toFixed(2)}%)` : undefined} />
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-ink-muted">Cost</p>
          <p className="num-col text-sm text-ink-secondary">{formatMoney(summary.cost)}</p>
        </div>
        {summary.returnPct !== null && (
          <div>
            <p className="text-xs text-ink-muted">Total return</p>
            <p className="text-sm">
              <Signed value={summary.totalReturn} suffix={` (${summary.returnPct.toFixed(1)}%)`} />
            </p>
          </div>
        )}
        {/* A plain gain percentage says the same thing whether the money went in
            ten years ago or last week. This one accounts for when. */}
        {summary.irr !== null && (
          <div>
            <p className="text-xs text-ink-muted">Annualised</p>
            <p className="num-col text-sm font-medium" style={{ color: summary.irr >= 0 ? PRIMARY : COMPLEMENT }}>
              {(summary.irr * 100).toFixed(1)}% a year
            </p>
          </div>
        )}
        {summary.dividends > 0 && (
          <div>
            <p className="text-xs text-ink-muted">Dividends</p>
            <p className="num-col text-sm text-ink-secondary">{formatMoney(summary.dividends)}</p>
          </div>
        )}
      </div>

      {/* Prices come from a third party, so the terms are stated where the
          feature is, not buried in settings: what is sent, how fresh it is, and
          how to turn it off. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-0 px-3 py-2">
        <p className="text-xs text-ink-muted">
          {!live.enabled ? (
            'Live prices are off — holdings use the price you recorded.'
          ) : live.error ? (
            <span className="text-critical-text">{live.error}</span>
          ) : live.loading && liveCount === 0 ? (
            'Fetching prices…'
          ) : liveCount > 0 ? (
            <>
              {liveCount} of {positions.length} priced live{delayed && ', 15 min delayed'}
              {live.lastFetchedAt && ` · updated ${formatTime(live.lastFetchedAt)}`}
              {' · only the ticker symbols leave your device'}
            </>
          ) : (
            'No live prices for these symbols.'
          )}
        </p>
        <span className="flex items-center gap-2">
          {live.enabled && (
            <Button variant="ghost" onClick={live.refresh} disabled={live.loading || positions.length === 0}>
              {live.loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={live.enabled}
              onChange={(e) => live.setEnabled(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-accent"
            />
            Live prices
          </label>
        </span>
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
              <SymbolPicker
                id="h-symbol"
                value={draft.symbol}
                onChange={(symbol) => setDraft({ ...draft, symbol })}
                onPick={(hit) => setDraft((d) => ({ ...d, symbol: hit.id, label: d.label || hit.description || hit.label }))}
                autoFocus
              />
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

      {positions.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Add what you own to make Net worth mean more than cash in the account."
        />
      ) : (
        <div className="space-y-2">
          {positions.map((p) => (
            <PositionRow key={p.holding.id} position={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
