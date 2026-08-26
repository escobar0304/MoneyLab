import type { LedgerEvent, Holding, TradeEvent, DividendEvent } from '../core/types';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Trades in the order they happened. Order matters: average cost depends on
 * what was held at the moment of each sell, so an out-of-order log produces a
 * different — and wrong — cost basis. */
export function foldTrades(events: LedgerEvent[]): TradeEvent[] {
  return events
    .filter((e): e is TradeEvent => e.type === 'trade')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function foldDividends(events: LedgerEvent[]): DividendEvent[] {
  return events
    .filter((e): e is DividendEvent => e.type === 'dividend')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export interface CostBasis {
  quantity: number;
  /** Cost basis of the quantity still held. */
  cost: number;
  avgCost: number;
  /** Gain already banked by selling, net of fees. */
  realized: number;
}

/**
 * Runs a trade log into a position, average-cost method.
 *
 * Average cost rather than FIFO because it is what a single-user tracker can
 * keep honest: FIFO needs every lot matched at sale time, and one corrected
 * trade date silently re-matches every lot after it. Average cost is also the
 * method Portuguese reporting accepts for funds.
 *
 * Fees are added to the basis on a buy and taken off the proceeds on a sell —
 * in both directions they reduce the gain, which is what actually happens.
 */
export function applyTrades(trades: TradeEvent[]): CostBasis {
  let quantity = 0;
  let cost = 0;
  let realized = 0;

  for (const t of trades) {
    const fees = t.fees ?? 0;
    if (t.side === 'buy') {
      quantity += t.quantity;
      cost += t.quantity * t.price + fees;
      continue;
    }

    // Selling more than the log says is held would drive the basis negative and
    // poison every later figure. Clamp instead, and let the UI refuse it up
    // front — a ledger that quietly accepts impossible states is worse than one
    // that shows a slightly odd total.
    const sold = Math.min(t.quantity, quantity);
    if (sold <= 0) continue;
    const basis = quantity > 0 ? (cost / quantity) * sold : 0;
    realized += sold * t.price - fees - basis;
    quantity -= sold;
    cost -= basis;
  }

  // Floating-point residue after selling everything reads as "0.0000001 shares
  // worth €0.00", which looks like a bug.
  if (quantity < 1e-9) {
    quantity = 0;
    cost = 0;
  }

  return {
    quantity,
    cost: roundCents(cost),
    avgCost: quantity > 0 ? cost / quantity : 0,
    realized: roundCents(realized),
  };
}

export interface Position {
  holding: Holding;
  quantity: number;
  cost: number;
  avgCost: number;
  value: number;
  unrealized: number;
  realized: number;
  dividends: number;
  /** unrealized + realized + dividends. */
  totalReturn: number;
  /** Money-weighted annual return, or null when it cannot be computed. */
  irr: number | null;
  priced: boolean;
  tradeCount: number;
}

/**
 * A holding's full position, given its trades and dividends.
 *
 * Holdings recorded before the trade log existed (or entered by hand, which is
 * still the quickest way to log something you have held for years) carry their
 * own quantity and average cost. Those are used as-is when there are no trades,
 * so nothing that already worked stops working.
 */
export function positionFor(holding: Holding, trades: TradeEvent[], dividends: DividendEvent[], now: Date = new Date()): Position {
  const own = trades.filter((t) => t.holdingId === holding.id);
  const paid = dividends.filter((d) => d.holdingId === holding.id);

  const basis: CostBasis =
    own.length > 0
      ? applyTrades(own)
      : { quantity: holding.quantity, cost: roundCents(holding.quantity * holding.avgCost), avgCost: holding.avgCost, realized: 0 };

  const priced = holding.lastPrice !== undefined;
  const value = priced ? roundCents(basis.quantity * (holding.lastPrice as number)) : basis.cost;
  const dividendTotal = roundCents(paid.reduce((sum, d) => sum + d.amount, 0));
  const unrealized = roundCents(value - basis.cost);

  return {
    holding,
    quantity: basis.quantity,
    cost: basis.cost,
    avgCost: basis.avgCost,
    value,
    unrealized,
    realized: basis.realized,
    dividends: dividendTotal,
    totalReturn: roundCents(unrealized + basis.realized + dividendTotal),
    irr: xirr(cashflowsFor(own, paid, value, now)),
    priced,
    tradeCount: own.length,
  };
}

/** A live price keyed by symbol. Structural, so investments.ts stays unaware of
 * where quotes come from. */
export interface PriceOverlay {
  [symbol: string]: { basePrice: number; fetchedAt: string } | undefined;
}

/**
 * Positions for a ledger, with live prices applied where there are any.
 *
 * The single place the overlay happens. It used to be done inside the store's
 * hook, which left the Overview — which builds its own positions so that time
 * travel can filter the events first — quietly pricing everything at cost.
 */
export function positionsFrom(events: LedgerEvent[], holdings: Holding[], prices: PriceOverlay = {}): Position[] {
  const trades = foldTrades(events);
  const dividends = foldDividends(events);
  return holdings.map((h) => {
    const quote = prices[h.symbol.toUpperCase()];
    const priced = quote ? { ...h, lastPrice: quote.basePrice, lastPriceAt: quote.fetchedAt } : h;
    return positionFor(priced, trades, dividends);
  });
}

export interface Cashflow {
  date: Date;
  amount: number;
}

/** Every euro in and out of a position, ending with what it is worth now — the
 * terminal flow is what makes an unsold holding measurable at all. */
export function cashflowsFor(trades: TradeEvent[], dividends: DividendEvent[], currentValue: number, now: Date): Cashflow[] {
  const flows: Cashflow[] = [];
  for (const t of trades) {
    const fees = t.fees ?? 0;
    flows.push({
      date: new Date(t.timestamp),
      amount: t.side === 'buy' ? -(t.quantity * t.price + fees) : t.quantity * t.price - fees,
    });
  }
  for (const d of dividends) flows.push({ date: new Date(d.timestamp), amount: d.amount });
  if (currentValue !== 0) flows.push({ date: now, amount: currentValue });
  return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const DAYS_PER_YEAR = 365;

function npv(flows: Cashflow[], rate: number, t0: number): number {
  let sum = 0;
  for (const f of flows) {
    const years = (f.date.getTime() - t0) / (86_400_000 * DAYS_PER_YEAR);
    sum += f.amount / Math.pow(1 + rate, years);
  }
  return sum;
}

/**
 * Money-weighted annual return over irregular cashflows (Excel's XIRR).
 *
 * The right measure when contributions are uneven: a simple gain percentage
 * says a holding bought in two lots returned the same whether the second lot
 * went in last year or last week, which is plainly false.
 *
 * Solved by bisection rather than Newton-Raphson. Newton is faster but diverges
 * on the shapes that actually occur here — a large late contribution puts a
 * near-vertical section in the curve — and a return figure that silently comes
 * back wrong is worse than one that takes 200 cheap iterations.
 */
export function xirr(flows: Cashflow[], now: Date = new Date()): number | null {
  if (flows.length < 2) return null;
  // Without both signs there is no rate that zeroes the NPV — all-outflow or
  // all-inflow histories have no return, they have a balance.
  if (!flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return null;

  const t0 = Math.min(...flows.map((f) => f.date.getTime()), now.getTime());
  // Everything on the same day: no elapsed time to annualise over.
  if (Math.max(...flows.map((f) => f.date.getTime())) - t0 < 86_400_000) return null;

  let low = -0.9999; // −100% is the asymptote; approach it, never touch it
  let high = 10; // 1000% a year, comfortably past anything real
  let fLow = npv(flows, low, t0);
  let fHigh = npv(flows, high, t0);

  // Push the ceiling up for genuinely explosive returns before giving up.
  for (let i = 0; i < 6 && fLow * fHigh > 0; i++) {
    high *= 10;
    fHigh = npv(flows, high, t0);
  }
  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(flows, mid, t0);
    if (Math.abs(fMid) < 1e-7 || high - low < 1e-9) return Math.round(mid * 10_000) / 10_000;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return Math.round(((low + high) / 2) * 10_000) / 10_000;
}

export interface InvestmentSummary {
  cost: number;
  value: number;
  unrealized: number;
  realized: number;
  dividends: number;
  totalReturn: number;
  /** Return as a share of cost. Null when nothing has been bought. */
  returnPct: number | null;
  /** Money-weighted annual return across the whole portfolio. */
  irr: number | null;
  unpriced: number;
  stalestPriceAt: string | null;
}

export function investmentSummary(positions: Position[], trades: TradeEvent[], dividends: DividendEvent[], now: Date = new Date()): InvestmentSummary {
  let cost = 0;
  let value = 0;
  let realized = 0;
  let dividendTotal = 0;
  let unpriced = 0;
  let stalest: string | null = null;

  for (const p of positions) {
    cost += p.cost;
    value += p.value;
    realized += p.realized;
    dividendTotal += p.dividends;
    if (!p.priced) unpriced++;
    else if (p.holding.lastPriceAt && (!stalest || p.holding.lastPriceAt < stalest)) stalest = p.holding.lastPriceAt;
  }

  const unrealized = value - cost;
  const totalReturn = unrealized + realized + dividendTotal;

  return {
    cost: roundCents(cost),
    value: roundCents(value),
    unrealized: roundCents(unrealized),
    realized: roundCents(realized),
    dividends: roundCents(dividendTotal),
    totalReturn: roundCents(totalReturn),
    returnPct: cost > 0 ? roundCents((totalReturn / cost) * 100) : null,
    irr: xirr(cashflowsFor(trades, dividends, roundCents(value), now), now),
    unpriced,
    stalestPriceAt: stalest,
  };
}
