import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn, money, type SeedEvent } from './helpers';

test.describe('period review', () => {
  const base: SeedEvent[] = [category('Groceries'), income(2000, 'Salary', dayIn(0)), expense(500, 'Groceries', dayIn(0))];

  test('opens on the current month and switches to a full year', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Year & month in review' }).click();

    const dialog = page.getByRole('dialog');
    // 2000 in, 500 out — 1500 saved, whichever period this month falls in.
    await expect(dialog.getByText(money(1500)).first()).toBeVisible();

    await dialog.getByRole('button', { name: 'Year', exact: true }).click();
    await expect(dialog.getByText(money(1500)).first()).toBeVisible();
  });

  test('says nothing was logged in a year with no activity', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Year & month in review' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Year', exact: true }).click();
    await dialog.getByRole('button', { name: 'Previous period' }).click();

    await expect(dialog.getByText('Nothing logged in this period.')).toBeVisible();
  });

  test('the next arrow stops at the current period', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Year & month in review' }).click();

    await expect(page.getByRole('dialog').getByRole('button', { name: 'Next period' })).toBeDisabled();
  });
});

test.describe('coming up', () => {
  /** A fixed number of days out, regardless of which day this actually runs
   * on — a calendar-month-relative date would put the next occurrence
   * anywhere from a few days to six weeks away depending on today's date. */
  function daysFromNow(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  test('lists a scheduled recurring charge with its due date', async ({ page }) => {
    const rule: SeedEvent = {
      id: 'rule-rent',
      type: 'recurring_upsert',
      timestamp: dayIn(-1),
      rule: {
        id: 'rent',
        kind: 'expense',
        label: 'Rent',
        amount: 900,
        category: 'Rent',
        cycle: 'monthly',
        startDate: daysFromNow(10),
        active: true,
      },
    };
    await seed(page, [category('Rent'), income(2000, 'Salary', dayIn(0)), rule]);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
    // Exact: a substring match for "Rent" also catches unrelated text
    // elsewhere on the page that happens to contain the word.
    await expect(page.getByText('Rent', { exact: true })).toBeVisible();
    await expect(page.getByText('in 10 days')).toBeVisible();
    await expect(page.getByText(money(900))).toBeVisible();
  });

  test('stays off the page when nothing is scheduled', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0)), expense(500, 'Groceries', dayIn(0))]);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Coming up' })).toHaveCount(0);
  });
});
