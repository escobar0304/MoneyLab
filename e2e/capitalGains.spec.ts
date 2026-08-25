import { test, expect } from '@playwright/test';
import { seed, monthOffset, money, type SeedEvent } from './helpers';

const holding: SeedEvent = {
  id: 'h1',
  type: 'holding_upsert',
  timestamp: `${monthOffset(-6)}-01T00:00:00.000Z`,
  holding: { id: 'h1', symbol: 'AAPL', label: 'Apple', quantity: 0, avgCost: 0 },
};
const buy: SeedEvent = {
  id: 't1',
  type: 'trade',
  timestamp: `${monthOffset(-6)}-05T00:00:00.000Z`,
  holdingId: 'h1',
  side: 'buy',
  quantity: 10,
  price: 100,
};
const sell: SeedEvent = {
  id: 't2',
  type: 'trade',
  timestamp: `${monthOffset(-1)}-05T00:00:00.000Z`,
  holdingId: 'h1',
  side: 'sell',
  quantity: 10,
  price: 150,
};

test.describe('capital gains', () => {
  test('reports the realised gain on a sold holding, for the year it sold in', async ({ page }) => {
    await seed(page, [holding, buy, sell]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Portfolio', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Capital gains' })).toBeVisible();
    // 10 units bought at 100, sold at 150 -> a 500 gain.
    await expect(page.getByText(money(500)).first()).toBeVisible();
    // AAPL also appears in the holdings list above, hence .first().
    await expect(page.getByText('AAPL').first()).toBeVisible();
  });

  test('stays off the page when nothing has ever been sold', async ({ page }) => {
    await seed(page, [holding, buy]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Portfolio', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Capital gains' })).toHaveCount(0);
  });

  test('exports a CSV of the lots for the year, ready for the accountant', async ({ page }) => {
    await seed(page, [holding, buy, sell]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Portfolio', exact: true }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export for accountant' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^moneylab-capital-gains-\d{4}\.csv$/);
  });
});
