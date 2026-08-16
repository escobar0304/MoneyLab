import { test, expect, type Page } from '@playwright/test';
import { seed, income, category, dayIn, money, type SeedEvent } from './helpers';

/**
 * Live prices, with the quote route intercepted.
 *
 * Stubbed rather than hitting TradingView: a test that depends on the market
 * being open, and on Apple not moving, tells you nothing on a Sunday. The real
 * endpoint is covered by the contract test in proxy.spec.ts.
 */
async function stubQuotes(page: Page, rows: [string, number, number, number, string, string][]) {
  await page.route('**/tv-quote', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: rows.map(([s, close, pct, abs, cur, mode]) => ({ s, d: [close, pct, abs, cur, mode] })) }),
    })
  );
  // The euro rate, for anything quoted in another currency.
  await page.route('**/api.frankfurter.dev/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: '2026-08-12', rates: { EUR: 0.9 } }) })
  );
}

const holding = (id: string, symbol: string, label: string, quantity: number, avgCost: number): SeedEvent => ({
  id: `h-${id}`,
  type: 'holding_upsert',
  timestamp: dayIn(-2),
  holding: { id, symbol, label, quantity, avgCost },
});

const base: SeedEvent[] = [category('Groceries'), income(10_000, 'Salary', dayIn(-2))];

test.describe('live prices', () => {
  test('prices holdings from the quote feed and shows the day move', async ({ page }) => {
    await stubQuotes(page, [['XETR:VWCE', 200, 2.5, 5, 'EUR', 'delayed_streaming_900']]);
    await seed(page, [...base, holding('a', 'XETR:VWCE', 'All-World', 10, 100)], { livePrices: true });
    await page.goto('/');

    // 10 units at 200 = 2 000, up 10 × 5 = 50 today.
    await expect(page.getByText(money(2000)).first()).toBeVisible();
    await expect(page.getByText(/\+50,00\s?€/).first()).toBeVisible();
    await expect(page.getByText(/Live prices/).first()).toBeVisible();
  });

  test('converts a holding quoted in another currency', async ({ page }) => {
    // 100 USD at 0.9 = 90 EUR a unit. Adding the dollar figure straight in would
    // overstate the portfolio by more than 10%.
    await stubQuotes(page, [['NASDAQ:AAPL', 100, 1, 1, 'USD', 'delayed_streaming_900']]);
    await seed(page, [...base, holding('a', 'NASDAQ:AAPL', 'Apple', 10, 50)], { livePrices: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets', exact: true }).click();

    await expect(page.getByText(money(900)).first()).toBeVisible();
    await expect(page.getByText(/quoted 100.00 USD/)).toBeVisible();
  });

  test('says that a delayed price is delayed', async ({ page }) => {
    // Never imply real time when the venue reports on a quarter-hour delay.
    await stubQuotes(page, [['XETR:VWCE', 200, 0, 0, 'EUR', 'delayed_streaming_900']]);
    await seed(page, [...base, holding('a', 'XETR:VWCE', 'All-World', 10, 100)], { livePrices: true });
    await page.goto('/');
    await expect(page.getByText(/15 min delayed/).first()).toBeVisible();
  });

  test('falls back to the recorded price when the feed is unreachable', async ({ page }) => {
    await page.route('**/tv-quote', (route) => route.fulfill({ status: 502, body: '' }));
    await seed(page, [
      ...base,
      {
        id: 'h-a',
        type: 'holding_upsert',
        timestamp: dayIn(-2),
        holding: { id: 'a', symbol: 'XETR:VWCE', label: 'All-World', quantity: 10, avgCost: 100, lastPrice: 150, lastPriceAt: dayIn(-1) },
      },
    ], { livePrices: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets', exact: true }).click();

    // 10 × 150 from the recorded price, and the failure is stated rather than
    // shown as a suspiciously round number.
    await expect(page.getByText(money(1500)).first()).toBeVisible();
    await expect(page.getByText(/Could not reach the price service/)).toBeVisible();
  });

  test('turning live prices off returns to the recorded price', async ({ page }) => {
    await stubQuotes(page, [['XETR:VWCE', 200, 0, 0, 'EUR', 'streaming']]);
    await seed(page, [
      ...base,
      {
        id: 'h-a',
        type: 'holding_upsert',
        timestamp: dayIn(-2),
        holding: { id: 'a', symbol: 'XETR:VWCE', label: 'All-World', quantity: 10, avgCost: 100, lastPrice: 150, lastPriceAt: dayIn(-1) },
      },
    ], { livePrices: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets', exact: true }).click();
    await expect(page.getByText(money(2000)).first()).toBeVisible();

    await page.getByLabel('Live prices').uncheck();
    await page.reload();
    await page.getByRole('button', { name: 'Markets', exact: true }).click();

    await expect(page.getByText(/Live prices are off/)).toBeVisible();
    await expect(page.getByText(money(1500)).first()).toBeVisible();
  });

  test('the dashboard card breaks the portfolio down by holding', async ({ page }) => {
    await stubQuotes(page, [
      ['XETR:VWCE', 200, 1, 2, 'EUR', 'streaming'],
      ['EURONEXT:GALP', 20, -1, -0.2, 'EUR', 'streaming'],
    ]);
    await seed(page, [...base, holding('a', 'XETR:VWCE', 'All-World', 10, 100), holding('b', 'EURONEXT:GALP', 'Galp', 50, 15)], { livePrices: true });
    await page.goto('/');

    // 2 000 + 1 000 = 3 000, so the split is two thirds / one third.
    await expect(page.getByText('Portfolio', { exact: true })).toBeVisible();
    await expect(page.getByText(money(3000)).first()).toBeVisible();
    await expect(page.getByText('66.7%')).toBeVisible();
    await expect(page.getByText('33.3%')).toBeVisible();
  });

  test('net worth on the hero uses the live value', async ({ page }) => {
    await stubQuotes(page, [['XETR:VWCE', 200, 0, 0, 'EUR', 'streaming']]);
    await seed(page, [...base, holding('a', 'XETR:VWCE', 'All-World', 10, 100)], { livePrices: true });
    await page.goto('/');

    // 10 000 cash + 2 000 invested.
    await expect(page.getByText('Net worth', { exact: true })).toBeVisible();
    await expect(page.getByText(money(12_000)).first()).toBeVisible();
  });
});
