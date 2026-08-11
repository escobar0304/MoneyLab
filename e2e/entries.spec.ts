import { test, expect } from '@playwright/test';
import { seed, ledger, income, expense, category, dayIn, money } from './helpers';

/**
 * The journey the app exists for: money goes in, money goes out, the numbers
 * follow. Everything here asserts through the interface a person actually uses,
 * so a refactor that keeps the store correct but breaks the form still fails.
 */
test.describe('logging entries', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, [category('Groceries'), category('Rent'), income(1800, 'Salary', dayIn(0)), expense(42.5, 'Groceries', dayIn(0))]);
  });

  test('logs an expense and it lands in the ledger and the history', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries' }).click();

    await page.locator('#expense-amount').fill('19.99');
    await page.getByRole('radio', { name: 'Groceries' }).click();
    await page.locator('#expense-note').fill('Playwright shop');
    await page.getByRole('button', { name: 'Log expense' }).click();

    // The amount field clearing is the form's own signal that it accepted.
    await expect(page.locator('#expense-amount')).toHaveValue('');
    await expect(page.getByText('Playwright shop')).toBeVisible();

    const events = await ledger(page);
    const logged = events.filter((e) => e.type === 'expense' && e.note === 'Playwright shop');
    expect(logged).toHaveLength(1);
    expect(logged[0].amount).toBe(19.99);
    expect(logged[0].category).toBe('Groceries');
  });

  test('refuses to log without a category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries' }).click();

    await page.locator('#expense-amount').fill('12');
    await expect(page.getByRole('button', { name: 'Log expense' })).toBeDisabled();
    await expect(page.getByText('Pick a category and enter an amount.')).toBeVisible();
  });

  test('a new category becomes selectable and is reusable afterwards', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries' }).click();

    await page.getByRole('button', { name: '+ New', exact: true }).click();
    await page.getByLabel('New category name').fill('Transport');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Creating it also selects it — otherwise you would have to click the thing
    // you just made.
    await expect(page.getByRole('radio', { name: 'Transport' })).toHaveAttribute('aria-checked', 'true');

    await page.reload();
    await page.getByRole('button', { name: 'Entries' }).click();
    await expect(page.getByRole('radio', { name: 'Transport' })).toBeVisible();
  });

  test('the overview reflects what was logged', async ({ page }) => {
    await page.goto('/');
    // 1800 in, 42.50 out.
    await expect(page.getByText(money(1757.5)).first()).toBeVisible();
  });
});
