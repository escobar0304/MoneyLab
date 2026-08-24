import { test, expect } from '@playwright/test';
import { seed, income, expense, category, dayIn, money, ledger, openEntries, type SeedEvent } from './helpers';

const account = (id: string, label: string, kind = 'savings'): SeedEvent => ({
  id: `acc-${id}`,
  type: 'account_upsert',
  timestamp: dayIn(-2),
  account: { id, label, kind },
});

const transfer = (from: string, to: string, amount: number): SeedEvent => ({
  id: `tr-${from}-${to}-${amount}`,
  type: 'transfer',
  timestamp: dayIn(0),
  fromAccountId: from,
  toAccountId: to,
  amount,
});

// 3000 in, 200 out — a balance of 2800 to split up.
const base: SeedEvent[] = [category('Groceries'), income(3000, 'Salary', dayIn(0)), expense(200, 'Groceries', dayIn(0))];

test.describe('accounts', () => {
  test('offers to split the balance when there is only one pot', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await openEntries(page, 'manage');

    await expect(page.getByText('Everything sits in one pot.')).toBeVisible();
    await page.getByRole('button', { name: /Add .Savings./ }).click();

    // The transfer form only exists once there is somewhere to transfer to.
    await expect(page.getByLabel('From', { exact: true })).toBeVisible();
    await expect(page.getByText(money(2800)).first()).toBeVisible();
  });

  test('moving money between pots leaves the total untouched', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings')]);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByLabel('To', { exact: true }).selectOption('sav');
    await page.locator('#transfer-amount').fill('500');
    await page.getByRole('button', { name: 'Move it' }).click();

    await expect(page.getByText(money(2300)).first()).toBeVisible();
    await expect(page.getByText(money(500)).first()).toBeVisible();

    // The invariant, asserted where it matters: a transfer is not income and
    // not spending, so the headline figure must not have moved a cent.
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByText(money(2800)).first()).toBeVisible();
  });

  test('refuses to overdraw a pot, and writes nothing when it does', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings')]);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByLabel('From', { exact: true }).selectOption('sav');
    await page.getByLabel('To', { exact: true }).selectOption('main');
    await page.locator('#transfer-amount').fill('50');
    await page.getByRole('button', { name: 'Move it' }).click();

    await expect(page.getByRole('alert')).toContainText('only holds');
    expect((await ledger(page)).filter((e) => e.type === 'transfer')).toHaveLength(0);
  });

  test('an expense can be paid out of a sub-account', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings'), transfer('main', 'sav', 500)]);
    await page.goto('/');
    await openEntries(page, 'log');

    await page.locator('#expense-amount').fill('60');
    await page.getByRole('radio', { name: 'Groceries' }).click();
    await page.getByLabel('Paid from').selectOption('sav');
    await page.getByRole('button', { name: 'Log expense' }).click();

    // The account balance lives in Manage, not on the form that just posted it.
    await openEntries(page, 'manage');
    await expect(page.getByText(money(440)).first()).toBeVisible();
    const logged = (await ledger(page)).filter((e) => e.type === 'expense' && e.amount === 60);
    expect(logged[0].accountId).toBe('sav');
  });

  test('closing a pot sweeps what is in it back to the main account', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings'), transfer('main', 'sav', 500)]);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByRole('button', { name: 'Edit Savings' }).click();
    await page.getByRole('button', { name: 'Close account' }).click();
    await expect(page.getByText(/moves back to Main/)).toBeVisible();
    await page.getByRole('button', { name: 'Close it' }).click();

    // Back to one pot holding everything — nothing was stranded in the closed one.
    await expect(page.getByText('Everything sits in one pot.')).toBeVisible();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByText(money(2800)).first()).toBeVisible();
  });

  test('the overview breaks the balance down by pot', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings'), transfer('main', 'sav', 700)]);
    await page.goto('/');

    await expect(page.getByText('Accounts', { exact: true })).toBeVisible();
    await expect(page.getByText(money(2100)).first()).toBeVisible();
    await expect(page.getByText(money(700)).first()).toBeVisible();
  });

  test('main can be renamed and stays the account everything falls back to', async ({ page }) => {
    await seed(page, [...base, account('sav', 'Savings')]);
    await page.goto('/');
    await openEntries(page, 'manage');

    await page.getByRole('button', { name: 'Edit Main' }).click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Current account');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    // Renamed, still holding the untagged history, and still not closable.
    await expect(page.getByRole('button', { name: 'Edit Current account' })).toBeVisible();
    await expect(page.getByText(money(2800)).first()).toBeVisible();
    await page.getByRole('button', { name: 'Edit Current account' }).click();
    await expect(page.getByRole('button', { name: 'Close account' })).toHaveCount(0);
  });
});
