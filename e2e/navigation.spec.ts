import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn } from './helpers';

const base = [category('Groceries'), income(1800, 'Salary', dayIn(0)), expense(42.5, 'Groceries', dayIn(0))];

test.describe('navigation and shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    // The shortcut listener is attached in an effect, so keys pressed between
    // `load` and React mounting go nowhere. Waiting on rendered content is the
    // signal that the app is actually running.
    await expect(page.getByRole('heading', { name: 'Monthly snapshot' })).toBeVisible();
  });

  test('every route loads its own lazy chunk without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const [tab, heading] of [
      ['Entries', 'Log expense'],
      ['Plan', 'Savings goals'],
      ['IRS', 'IRS deductions'],
      ['Portfolio', 'Portfolio'],
      ['Markets', 'Watchlist'],
      ['Settings', 'Data'],
      ['Overview', 'Monthly snapshot'],
    ] as const) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('the g chord navigates, including to the new Plan page', async ({ page }) => {
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page.getByRole('heading', { name: 'Savings goals' })).toBeVisible();

    await page.keyboard.press('g');
    await page.keyboard.press('i');
    await expect(page.getByRole('heading', { name: 'IRS deductions' })).toBeVisible();

    await page.keyboard.press('g');
    await page.keyboard.press('h');
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();

    await page.keyboard.press('g');
    await page.keyboard.press('m');
    await expect(page.getByRole('heading', { name: 'Watchlist' })).toBeVisible();
  });

  test('n opens the expense form with the amount focused', async ({ page }) => {
    await page.keyboard.press('n');
    await expect(page.locator('#expense-amount')).toBeFocused();
  });

  test('a letter typed in a field is a character, not a command', async ({ page }) => {
    // The single most important property of the shortcut layer. Typed key by
    // key, not filled: `fill` sets the value without keystrokes and would assert
    // nothing about the handler.
    //
    // Navigated by clicking rather than with `n`, deliberately. `n` starts a
    // short polling loop that moves focus to the amount field once the lazy
    // chunk arrives, and under load that can land mid-word and truncate what is
    // being typed here — a race in the test, not in the app.
    await page.getByRole('button', { name: 'Entries', exact: true }).click();
    const note = page.locator('#expense-note');
    await note.click();
    await note.pressSequentially('gp nice');

    await expect(note).toHaveValue('gp nice');
    await expect(page.getByRole('heading', { name: 'Log expense' })).toBeVisible();
  });

  test('? shows the shortcut list and Escape closes it', async ({ page }) => {
    await page.keyboard.press('Shift+Slash');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Go to Plan')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
