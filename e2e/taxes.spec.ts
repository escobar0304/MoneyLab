import { test, expect } from '@playwright/test';
import { seed, category, income, dayIn } from './helpers';

test.describe('taxes', () => {
  test('always shows the IRS filing deadline, even with no vehicles', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Taxes', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Fiscal calendar' })).toBeVisible();
    await expect(page.getByText('IRS (Modelo 3) filing deadline')).toBeVisible();
    await expect(page.getByText('No vehicles yet')).toBeVisible();
  });

  test('adds a vehicle and its IUC due date appears on the calendar', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Taxes', exact: true }).click();

    await page.getByRole('button', { name: '+ Add vehicle' }).click();
    await page.getByLabel('Plate').fill('00-aa-00');
    await page.getByLabel('Registration date').fill('2018-09-12');
    await page.getByLabel('Annual IUC').fill('180');
    await page.getByRole('button', { name: 'Add vehicle' }).click();

    // The plate is upper-cased on save. Exact: a substring match also catches
    // the calendar's own "IUC · 00-AA-00" line.
    await expect(page.getByText('00-AA-00', { exact: true })).toBeVisible();
    await expect(page.getByText('IUC · 00-AA-00')).toBeVisible();
  });

  test('splitting into installments replaces the single default payment', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Taxes', exact: true }).click();

    await page.getByRole('button', { name: '+ Add vehicle' }).click();
    await page.getByLabel('Plate').fill('00-AA-00');
    await page.getByLabel('Registration date').fill('2018-09-12');
    await page.getByLabel('Annual IUC').fill('180');
    await page.getByRole('button', { name: '+ Add payment' }).click();
    await page.getByLabel('Payment 1 date').fill('2026-09-12');
    await page.getByLabel('Payment 1 amount').fill('90');
    await page.getByRole('button', { name: '+ Add payment' }).click();
    await page.getByLabel('Payment 2 date').fill('2026-03-12');
    await page.getByLabel('Payment 2 amount').fill('90');
    await page.getByRole('button', { name: 'Add vehicle' }).click();

    // Two IUC lines on the calendar, one per installment, instead of one.
    await expect(page.getByText('IUC · 00-AA-00')).toHaveCount(2);
  });

  test('removing a vehicle drops its due date off the calendar', async ({ page }) => {
    await seed(page, [category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Taxes', exact: true }).click();

    await page.getByRole('button', { name: '+ Add vehicle' }).click();
    await page.getByLabel('Plate').fill('00-AA-00');
    await page.getByLabel('Registration date').fill('2018-09-12');
    await page.getByLabel('Annual IUC').fill('180');
    await page.getByRole('button', { name: 'Add vehicle' }).click();

    await page.getByRole('button', { name: 'Remove 00-AA-00' }).click();
    await expect(page.getByText('IUC · 00-AA-00')).toHaveCount(0);
    await expect(page.getByText('No vehicles yet')).toBeVisible();
  });
});
