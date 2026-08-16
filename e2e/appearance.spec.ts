import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn } from './helpers';

test.describe('density', () => {
  test('compact tightens the panels and survives a reload', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0)), expense(40, 'Groceries', dayIn(0))]);
    await page.goto('/');

    const card = page.locator('.card-pad').first();
    const comfortable = await card.evaluate((el) => getComputedStyle(el).paddingTop);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('radio', { name: 'Compact' }).check();

    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    const compact = await card.evaluate((el) => getComputedStyle(el).paddingTop);
    expect(parseFloat(compact)).toBeLessThan(parseFloat(comfortable));

    // Applied before the first paint, so a reload never flashes the other one.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    expect(await card.evaluate((el) => getComputedStyle(el).paddingTop)).toBe(compact);
  });
});
