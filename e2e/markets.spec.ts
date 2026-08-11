import { test, expect } from '@playwright/test';
import { seed, ledger, income, category, dayIn, money } from './helpers';

const base = [category('Groceries'), income(5000, 'Salary', dayIn(-2))];

test.describe('portfolio', () => {
  test('the symbol picker offers real instruments and fills in the name', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets' }).click();

    await page.getByRole('button', { name: '+ Add holding' }).click();
    await page.locator('#h-symbol').fill('VWCE');

    // The catalogue answers with no network at all, so this assertion holds
    // whether or not the search proxy is reachable from CI.
    const option = page.getByRole('option', { name: /VWCE/ }).first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.locator('#h-symbol')).toHaveValue('XETR:VWCE');
    // A ticker alone is not identification — the description comes along.
    await expect(page.locator('#h-label')).not.toHaveValue('');
  });

  test('a trade log takes over from a hand-entered position without losing it', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets' }).click();

    await page.getByRole('button', { name: '+ Add holding' }).click();
    await page.locator('#h-symbol').fill('XETR:VWCE');
    await page.locator('#h-label').fill('All-World');
    await page.locator('#h-qty').fill('10');
    await page.locator('#h-cost').fill('100');
    await page.locator('#h-price').fill('120');
    await page.getByRole('button', { name: 'Add holding' }).click();

    await expect(page.getByText(/\+200,00\s€/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Trades' }).click();
    await expect(page.getByText(/become an opening purchase/)).toBeVisible();

    // Buy 10 more at 130. The opening 10 must survive as a seeded trade,
    // otherwise the first logged trade would quietly erase what was owned.
    await page.locator('[id^="qty-"]').fill('10');
    await page.locator('[id^="px-"]').fill('130');
    await page.getByRole('button', { name: 'Add trade' }).click();

    const trades = (await ledger(page)).filter((e) => e.type === 'trade');
    expect(trades).toHaveLength(2);
    // 20 units at an average of 115.
    await expect(page.getByText(/20 @ 115,00\s€/)).toBeVisible();
  });

  test('selling books a realised gain and leaves the average cost alone', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets' }).click();

    await page.getByRole('button', { name: '+ Add holding' }).click();
    await page.locator('#h-symbol').fill('XETR:VWCE');
    await page.locator('#h-qty').fill('10');
    await page.locator('#h-cost').fill('100');
    await page.locator('#h-price').fill('150');
    await page.getByRole('button', { name: 'Add holding' }).click();

    await page.getByRole('button', { name: 'Trades' }).click();
    await page.getByRole('button', { name: 'sell' }).click();
    await page.locator('[id^="qty-"]').fill('4');
    await page.locator('[id^="px-"]').fill('150');
    await page.getByRole('button', { name: 'Add trade' }).click();

    // 4 × (150 − 100) = 200 banked; the remaining 6 stay at cost 100. The
    // opening position must sort before the same-day sale for either to be true.
    await expect(page.getByText(/realised/)).toBeVisible();
    await expect(page.getByText(/6 @ 100,00\s€/)).toBeVisible();
    // 6 units at 150 — shown both as the portfolio total and as this position.
    await expect(page.getByText(money(900)).first()).toBeVisible();
  });

  test('refuses to sell more than is held', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Markets' }).click();

    await page.getByRole('button', { name: '+ Add holding' }).click();
    await page.locator('#h-symbol').fill('XETR:VWCE');
    await page.locator('#h-qty').fill('5');
    await page.locator('#h-cost').fill('100');
    await page.getByRole('button', { name: 'Add holding' }).click();

    await page.getByRole('button', { name: 'Trades' }).click();
    // Seed the trade log first, so the guard is testing the log rather than the
    // hand-entered fallback.
    await page.locator('[id^="qty-"]').fill('1');
    await page.locator('[id^="px-"]').fill('100');
    await page.getByRole('button', { name: 'Add trade' }).click();

    await page.getByRole('button', { name: 'sell' }).click();
    await page.locator('[id^="qty-"]').fill('999');
    await page.locator('[id^="px-"]').fill('100');
    await expect(page.getByText(/Only 6 units are held\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add trade' })).toBeDisabled();
  });
});
