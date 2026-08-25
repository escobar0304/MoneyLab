import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn, money } from './helpers';

test.describe('what changed this month', () => {
  test('flags a category with no history before this month', async ({ page }) => {
    await seed(page, [category('Groceries'), category('Ski trip'), income(2000, 'Salary', dayIn(0)), expense(450, 'Ski trip', dayIn(0))]);
    await page.goto('/');

    await expect(page.getByText('New this month')).toBeVisible();
    // Scoped to the row: "Ski trip" and its amount also appear in the spend
    // chart's own accessible data table elsewhere on the page.
    const row = page.locator('li').filter({ hasText: 'Ski trip' }).filter({ hasText: 'first time' });
    await expect(row).toBeVisible();
    await expect(row.getByText(money(450))).toBeVisible();
  });

  test('stays off the page once every category has history behind it', async ({ page }) => {
    // Groceries logged last month too, so June isn't its first appearance —
    // nothing here is new, and nothing here is set up to look quiet either.
    await seed(page, [
      category('Groceries'),
      income(2000, 'Salary', dayIn(0)),
      expense(80, 'Groceries', dayIn(-1)),
      expense(80, 'Groceries', dayIn(0)),
    ]);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: "What's different this month" })).toHaveCount(0);
  });
});
