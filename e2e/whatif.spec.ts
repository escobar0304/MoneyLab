import { test, expect } from '@playwright/test';
import { seed, ledger, income, category, dayIn, monthOffset, money, type SeedEvent } from './helpers';

const rentRule: SeedEvent = {
  id: 'rule-rent',
  type: 'recurring_upsert',
  timestamp: `${monthOffset(-2)}-01T00:00:00.000Z`,
  rule: { id: 'rent', kind: 'expense', label: 'Rent', amount: 700, category: 'Rent', cycle: 'monthly', startDate: `${monthOffset(-2)}-01`, active: true },
};

test.describe('what if', () => {
  test('projects the effect of a new recurring income without logging anything', async ({ page }) => {
    await seed(page, [category('Rent'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    const before = (await ledger(page)).length;

    await page.getByRole('button', { name: 'What if?' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Label').fill('Freelance');
    await dialog.getByLabel('Amount').fill('300');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect(dialog.getByText('Freelance')).toBeVisible();
    await expect(dialog.getByText(money(300)).first()).toBeVisible();
    await expect(dialog.getByText('Effect on next month')).toBeVisible();

    // Nothing was actually written to the ledger.
    await dialog.getByRole('button', { name: 'Close' }).click();
    expect((await ledger(page)).length).toBe(before);
  });

  test('offers a real active recurring rule to cancel, and reflects it as freeing money', async ({ page }) => {
    await seed(page, [category('Rent'), income(2000, 'Salary', dayIn(0)), rentRule]);
    await page.goto('/');

    await page.getByRole('button', { name: 'What if?' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancel a rule', exact: true }).click();
    await dialog.getByLabel('Rule to cancel').selectOption('rent');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect(dialog.getByText('Cancel Rent')).toBeVisible();
    // Cancelling an expense frees money up — a positive effect.
    const effect = dialog.locator('p.t-title');
    await expect(effect).toContainText('+');
  });

  test('says nothing to project until a change has been added', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');

    await page.getByRole('button', { name: 'What if?' }).click();
    await expect(page.getByRole('dialog').getByText('Add a change above to see what it would do to the months ahead.')).toBeVisible();
  });
});
