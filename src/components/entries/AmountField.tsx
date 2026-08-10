import { useEffect, useRef, useState } from 'react';
import { BASE_CURRENCY, COMMON_CURRENCIES, fetchRate, toBase, formatForeign } from '../../lib/currency';
import { formatMoney } from '../../lib/format';
import { Input, Label, Select } from '../ui/primitives';
import type { ForeignAmount } from '../../lib/types';

export interface AmountValue {
  /** Always in the base currency — this is what gets stored on the event. */
  base: number;
  foreign?: ForeignAmount;
}

type RateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; rate: number; rateDate: string }
  | { status: 'manual'; reason: string };

/**
 * Amount plus currency, resolving to a base-currency figure before it is stored.
 *
 * The rate is looked up for the *date of the entry*, not today — see currency.ts
 * for why that distinction matters. When the lookup can't happen (offline, an
 * unknown code, a date before the ECB series starts) the field asks for the rate
 * instead of guessing, because a silently wrong rate is worse than a question.
 */
export function AmountField({
  amount,
  onAmountChange,
  date,
  onResolved,
  id = 'amount',
  label = 'Amount',
  placeholder = '45.00',
  onSubmit,
}: {
  amount: string;
  onAmountChange: (v: string) => void;
  date: string;
  onResolved: (v: AmountValue | null) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const [currency, setCurrency] = useState(BASE_CURRENCY);
  const [manualRate, setManualRate] = useState('');
  const [state, setState] = useState<RateState>({ status: 'idle' });
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  // Look the rate up whenever the currency or the entry's date changes.
  useEffect(() => {
    if (currency === BASE_CURRENCY) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchRate(currency, date, controller.signal)
      .then((r) => setState({ status: 'ready', rate: r.rate, rateDate: r.date }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'manual', reason: err instanceof Error ? err.message : 'Rate unavailable' });
      });
    return () => controller.abort();
  }, [currency, date]);

  const numericAmount = Number(amount) || 0;
  const effectiveRate =
    currency === BASE_CURRENCY ? 1 : state.status === 'ready' ? state.rate : Number(manualRate) || 0;
  const baseAmount = currency === BASE_CURRENCY ? numericAmount : toBase(numericAmount, effectiveRate);

  // Publish the resolved value upward. Null means "not usable yet", which is
  // what keeps the submit button disabled while a rate is missing.
  useEffect(() => {
    if (numericAmount <= 0 || effectiveRate <= 0) {
      onResolvedRef.current(null);
      return;
    }
    onResolvedRef.current({
      base: baseAmount,
      foreign:
        currency === BASE_CURRENCY
          ? undefined
          : {
              currency,
              originalAmount: numericAmount,
              rate: effectiveRate,
              rateDate: state.status === 'ready' ? state.rateDate : date.slice(0, 10),
            },
    });
  }, [baseAmount, numericAmount, effectiveRate, currency, date, state]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          step={0.01}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit?.()}
          placeholder={placeholder}
        />
        <div className="w-24 shrink-0">
          <Select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {currency !== BASE_CURRENCY && (
        <div className="mt-1.5 text-xs">
          {state.status === 'loading' && <p className="text-ink-muted">Looking up the rate for that date…</p>}

          {state.status === 'ready' && (
            <p className="text-ink-muted">
              {formatForeign(numericAmount, currency)} ={' '}
              <span className="num-col text-ink-secondary">{formatMoney(baseAmount)}</span> · ECB rate of {state.rateDate}
            </p>
          )}

          {state.status === 'manual' && (
            <div className="rounded-md border border-complement/30 bg-complement/10 p-2">
              <p className="mb-1.5 text-ink-secondary">Couldn't fetch a rate ({state.reason}). Enter it manually.</p>
              <div className="flex items-center gap-2">
                <div className="w-28 shrink-0">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`Euros per 1 ${currency}`}
                  placeholder="0.92"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                />
                </div>
                <span className="text-ink-muted">
                  euros per 1 {currency}
                  {effectiveRate > 0 && (
                    <>
                      {' '}
                      → <span className="num-col text-ink-secondary">{formatMoney(baseAmount)}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
