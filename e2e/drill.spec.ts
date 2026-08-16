import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn, monthOffset, money, type SeedEvent } from './helpers';

/**
 * Drilling from a chart mark to the entries behind it.
 *
 * The claim under test is that the path back from a picture to its rows is
 * exact — the panel has to show the same entries, adding up to the same figure
 * the mark showed. A drill-down that is merely *approximately* the mark is
 * worse than none, because it looks authoritative.
 */
const base: SeedEvent[] = [
  category('Groceries'),
  category('Rent'),
  income(2000, 'Salary', dayIn(0)),
  expense(40, 'Groceries', dayIn(0), 'Lidl'),
  expense(25, 'Groceries', dayIn(0), 'Pingo Doce'),
  expense(900, 'Rent', dayIn(0)),
  // Last month, so anything scoped to this month must not pick it up.
  expense(500, 'Groceries', dayIn(-1), 'Old shop'),
];

test.describe('drilling into a chart mark', () => {
  test('a category in the pie legend opens exactly its entries', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');

    await page.getByRole('button', { name: 'Show what makes up Groceries' }).first().click();

    const panel = page.getByRole('dialog', { name: 'Groceries' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Lidl')).toBeVisible();
    await expect(panel.getByText('Pingo Doce')).toBeVisible();
    // Scoped to the month the mark was drawn for.
    await expect(panel.getByText('Old shop')).toHaveCount(0);
    await expect(panel.getByText('2 entries')).toBeVisible();
    await expect(panel.getByText(money(65))).toBeVisible();
  });

  test('the total in the panel is the figure the mark claimed', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');

    await page.getByRole('button', { name: "Show what makes up this month's spending" }).first().click();

    const panel = page.getByRole('dialog', { name: /Spending in/ });
    // 40 + 25 + 900 — the meter said the same number.
    await expect(panel.getByText(money(965))).toBeVisible();
    await expect(panel.getByText('3 entries')).toBeVisible();
  });

  test('a drilled row opens the entry, and closing it returns to the slice', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');

    await page.getByRole('button', { name: 'Show what makes up Groceries' }).first().click();
    const panel = page.getByRole('dialog', { name: 'Groceries' });
    await panel.getByRole('button', { name: /Open Groceries/ }).first().click();

    // The entry sits on top of the list rather than replacing it...
    await expect(page.getByText('Not verified yet')).toBeVisible();
    // ...and Escape backs out one level, not two.
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await expect(page.getByText('Not verified yet')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('a month on the income-vs-expenses chart opens everything that month', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');

    // The plot area, not a legend: this is the chart-level click path, which is
    // the only one a line chart has. Hover first — Recharts works out which
    // month is under the pointer on mousemove, and a cold click carries no
    // active label for the handler to read.
    const plot = page.getByRole('group', { name: 'Income vs. expenses' }).locator('.recharts-wrapper');
    const box = (await plot.boundingBox())!;
    // Near the right edge, which is the latest month — the centre sits between
    // two points and would open whichever happened to be nearer.
    const at = { position: { x: box.width * 0.9, y: box.height / 2 } };
    await plot.hover(at);
    await plot.click(at);

    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    // Income is in the slice too, so this is not a spend-only view.
    await expect(panel.getByText('Salary')).toBeVisible();
    await expect(panel.getByText('Old shop')).toHaveCount(0);
  });

  test('an account row opens everything filed to that account', async ({ page }) => {
    await seed(page, [
      ...base,
      { id: 'acc-sav', type: 'account_upsert', timestamp: dayIn(-2), account: { id: 'sav', label: 'Savings', kind: 'savings' } },
      { id: 'x1', type: 'expense', timestamp: dayIn(0), amount: 12, category: 'Groceries', note: 'From savings', accountId: 'sav' },
    ]);
    await page.goto('/');

    await page.getByRole('button', { name: /Savings/ }).first().click();
    const panel = page.getByRole('dialog', { name: 'Savings' });
    await expect(panel.getByText('From savings')).toBeVisible();
    await expect(panel.getByText('1 entry')).toBeVisible();
  });

  test('drilling follows time travel rather than showing today', async ({ page }) => {
    // Two charges in the same past month, either side of the date we rewind to.
    await seed(page, [
      category('Groceries'),
      income(2000, 'Salary', `${monthOffset(-1)}-02T12:00:00.000Z`),
      expense(30, 'Groceries', `${monthOffset(-1)}-05T12:00:00.000Z`, 'Before the cutoff'),
      expense(70, 'Groceries', `${monthOffset(-1)}-25T12:00:00.000Z`, 'After the cutoff'),
    ]);
    await page.goto('/');

    // Point the snapshot at that month first — while everything is still
    // visible, so the month is still offered.
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByLabel('View the dashboard as of').fill(`${monthOffset(-1)}-10`);

    await page.getByRole('button', { name: 'Show what makes up Groceries' }).first().click();
    const panel = page.getByRole('dialog', { name: 'Groceries' });

    // The mark was drawn from 30 €, so the rows behind it must be that 30 €.
    await expect(panel.getByText('Before the cutoff')).toBeVisible();
    await expect(panel.getByText('After the cutoff')).toHaveCount(0);
    await expect(panel.getByText(money(30)).first()).toBeVisible();
  });
});
