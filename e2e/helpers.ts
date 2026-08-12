import type { Page } from '@playwright/test';

/** The persist key and version the store writes. Kept here rather than imported
 * so a test failure points at a real behaviour change instead of silently
 * following the app's own rename. */
const STORAGE_KEY = 'moneylab-v1';
const LEDGER_VERSION = 2;

export interface SeedEvent {
  id: string;
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Puts a ledger in place before the app boots.
 *
 * `addInitScript` runs before any page script, which matters: zustand rehydrates
 * during module evaluation, so writing localStorage after `goto` would be read
 * only on the next navigation.
 *
 * It also runs again on every reload, which is why the write is conditional.
 * Seeding unconditionally would silently restore the starting ledger during
 * `page.reload()` — and reload is exactly what the tests about persistence and
 * idempotent generation are there to exercise, so they would have quietly
 * asserted nothing.
 */
export async function seed(page: Page, events: SeedEvent[], options: { livePrices?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ({ key, version, seeded, livePrices }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({ state: { events: seeded, lastExportedAt: null, lastBackupAt: null }, version })
        );
        // Under the same first-run guard as the ledger, and for the same
        // reason: this script runs again on every reload, so setting it
        // unconditionally would undo a toggle the test just flipped.
        //
        // Off unless a test asks for it — the preview server proxies quotes for
        // real, so leaving it on would let live market data overwrite the prices
        // a test set, making every portfolio assertion depend on what Apple did
        // this morning.
        localStorage.setItem('moneylab-live-prices', livePrices ? '1' : '0');
      }
      // Keep the rail predictable across tests regardless of what a previous
      // run left behind.
      localStorage.setItem('moneylab-sidebar-collapsed', '0');
    },
    { key: STORAGE_KEY, version: LEDGER_VERSION, seeded: events, livePrices: options.livePrices === true }
  );
}

/**
 * A matcher for an amount as the app actually renders it.
 *
 * pt-PT does not group four-digit numbers and separates the symbol with a
 * non-breaking space, so a hand-written "1 757,50 €" matches nothing. Formatting
 * through the same Intl call the app uses, then relaxing the whitespace, asserts
 * the value without pinning the locale's typography.
 */
export function money(amount: number): RegExp {
  const formatted = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount);
  return new RegExp(formatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s'));
}

/** The ledger as it currently stands in storage — the assertion surface for
 * anything whose effect is a written event rather than a visible number. */
export async function ledger(page: Page): Promise<SeedEvent[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return (JSON.parse(raw) as { state?: { events?: SeedEvent[] } }).state?.events ?? [];
  }, STORAGE_KEY);
}

let counter = 0;
const id = () => `e2e-${counter++}`;

export const income = (amount: number, label: string, timestamp: string): SeedEvent => ({
  id: id(),
  type: 'income',
  timestamp,
  amount,
  label,
});

export const expense = (amount: number, category: string, timestamp: string, note?: string): SeedEvent => ({
  id: id(),
  type: 'expense',
  timestamp,
  amount,
  category,
  ...(note ? { note } : {}),
});

export const category = (name: string): SeedEvent => ({
  id: id(),
  type: 'category_upsert',
  timestamp: '2026-01-01T00:00:00.000Z',
  name,
});

/** A month key relative to now, so seeded data never ages out of "this month"
 * and starts failing in January. */
export function monthOffset(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 7);
}

/** An ISO timestamp on the 15th of a month relative to now — mid-month, so it
 * can never land outside the month through a timezone shift. */
export function dayIn(months: number): string {
  return `${monthOffset(months)}-15T12:00:00.000Z`;
}
