import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn, ledger, openEntries, type SeedEvent } from './helpers';

const base: SeedEvent[] = [
  category('Groceries'),
  category('Uncategorised'),
  income(2000, 'Salary', dayIn(0)),
  expense(40, 'Uncategorised', dayIn(0), 'Lidl weekly'),
  expense(31, 'Uncategorised', dayIn(0), 'Lidl again'),
  expense(12, 'Groceries', dayIn(0), 'Bakery'),
];

/** Fills in the rule form and saves it. Assumes Entries is already open on Manage. */
async function makeRule(page: import('@playwright/test').Page, name: string, match: string, category: string) {
  await page.getByRole('button', { name: 'New rule' }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Condition 1 value').fill(match);
  await page.getByRole('dialog').getByRole('radio', { name: category }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
}

test.describe('rules', () => {
  test('a rule files a newly logged expense on the way in', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await makeRule(page, 'Supermarkets', 'lidl', 'Groceries');

    await openEntries(page, 'log');
    await page.locator('#expense-amount').fill('22');
    await page.getByRole('radio', { name: 'Uncategorised' }).click();
    await page.locator('#expense-note').fill('Lidl run');
    await page.getByRole('button', { name: 'Log expense' }).click();

    // Logged as Uncategorised, filed as Groceries — the rule did the work.
    const logged = (await ledger(page)).filter((e) => e.note === 'Lidl run');
    expect(logged).toHaveLength(1);
    expect(logged[0].category).toBe('Groceries');
  });

  test('shows a rule’s reach before it is saved', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByRole('button', { name: 'New rule' }).click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Supermarkets');
    await page.getByLabel('Condition 1 value').fill('lidl');
    await page.getByRole('dialog').getByRole('radio', { name: 'Groceries' }).click();

    await expect(page.getByText('Matches 2 entries in your ledger.')).toBeVisible();
  });

  test('adding a condition narrows the match rather than widening it', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByRole('button', { name: 'New rule' }).click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Big supermarket runs');
    await page.getByLabel('Condition 1 value').fill('lidl');
    await page.getByRole('dialog').getByRole('radio', { name: 'Groceries' }).click();
    await expect(page.getByText('Matches 2 entries in your ledger.')).toBeVisible();

    await page.getByRole('button', { name: 'Add condition' }).click();
    await page.getByLabel('Condition 2 field').selectOption('amount');
    await page.getByLabel('Condition 2 test').selectOption('gte');
    await page.getByLabel('Condition 2 value').fill('35');
    await expect(page.getByText('Matches 1 entry in your ledger.')).toBeVisible();
  });

  test('applying to older entries previews the change first, then makes it', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await makeRule(page, 'Supermarkets', 'lidl', 'Groceries');

    await page.getByRole('button', { name: /Apply to 2 older entries/ }).click();
    await expect(page.getByText('Category Uncategorised → Groceries').first()).toBeVisible();
    await page.getByRole('button', { name: 'Apply them' }).click();

    await expect(page.getByText('2 entries refiled.')).toBeVisible();
    const refiled = (await ledger(page)).filter((e) => e.type === 'expense' && String(e.note ?? '').startsWith('Lidl'));
    expect(refiled.every((e) => e.category === 'Groceries')).toBe(true);
    // Nothing that no rule matched was touched.
    const bakery = (await ledger(page)).find((e) => e.note === 'Bakery');
    expect(bakery?.category).toBe('Groceries');
  });

  test('a rule can route an entry to another account', async ({ page }) => {
    await seed(page, [
      ...base,
      { id: 'acc-inv', type: 'account_upsert', timestamp: dayIn(-2), account: { id: 'inv', label: 'Investments', kind: 'investment' } },
    ]);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByRole('button', { name: 'New rule' }).click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Broker top-ups');
    await page.getByLabel('Condition 1 value').fill('trading 212');
    await page.getByRole('dialog').getByLabel('Account', { exact: true }).selectOption('inv');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    await openEntries(page, 'log');
    await page.locator('#expense-amount').fill('300');
    await page.getByRole('radio', { name: 'Uncategorised' }).click();
    await page.locator('#expense-note').fill('Trading 212 top-up');
    await page.getByRole('button', { name: 'Log expense' }).click();

    const logged = (await ledger(page)).filter((e) => e.note === 'Trading 212 top-up');
    expect(logged[0].accountId).toBe('inv');
  });

  test('an inactive rule stops filing without being deleted', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await makeRule(page, 'Supermarkets', 'lidl', 'Groceries');
    await page.getByLabel('Supermarkets active').uncheck();

    await openEntries(page, 'log');
    await page.locator('#expense-amount').fill('18');
    await page.getByRole('radio', { name: 'Uncategorised' }).click();
    await page.locator('#expense-note').fill('Lidl paused');
    await page.getByRole('button', { name: 'Log expense' }).click();

    const logged = (await ledger(page)).filter((e) => e.note === 'Lidl paused');
    expect(logged[0].category).toBe('Uncategorised');
  });
});
