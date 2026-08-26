import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Symbol {
  /** TradingView symbol, e.g. "NASDAQ:AAPL" or "BINANCE:BTCEUR". */
  id: string;
  label: string;
}

/** A starting set covering the asset classes this app's owner is likely to look
 * at, priced in EUR where TradingView offers it. Fully editable. */
const DEFAULTS: Symbol[] = [
  { id: 'BINANCE:BTCEUR', label: 'Bitcoin' },
  { id: 'BINANCE:ETHEUR', label: 'Ethereum' },
  { id: 'FX:EURUSD', label: 'EUR / USD' },
  { id: 'NASDAQ:AAPL', label: 'Apple' },
  { id: 'NASDAQ:NVDA', label: 'Nvidia' },
  { id: 'AMEX:SPY', label: 'S&P 500' },
  { id: 'TVC:GOLD', label: 'Gold' },
];

interface WatchlistState {
  symbols: Symbol[];
  selected: string;
  select: (id: string) => void;
  add: (symbol: Symbol) => void;
  remove: (id: string) => void;
  reset: () => void;
}

/** Kept in its own store, and its own storage key, so market preferences never
 * end up inside the financial ledger's export. */
export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      symbols: DEFAULTS,
      selected: DEFAULTS[0].id,

      select: (id) => set({ selected: id }),

      add: (symbol) => {
        const id = symbol.id.trim().toUpperCase();
        if (!id) return;
        if (get().symbols.some((s) => s.id === id)) {
          set({ selected: id });
          return;
        }
        set((s) => ({
          symbols: [...s.symbols, { id, label: symbol.label.trim() || id.split(':').pop() || id }],
          selected: id,
        }));
      },

      remove: (id) =>
        set((s) => {
          const symbols = s.symbols.filter((x) => x.id !== id);
          return {
            symbols,
            selected: s.selected === id ? (symbols[0]?.id ?? '') : s.selected,
          };
        }),

      reset: () => set({ symbols: DEFAULTS, selected: DEFAULTS[0].id }),
    }),
    { name: 'moneylab-watchlist-v1' }
  )
);
