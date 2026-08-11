import { test, expect } from '@playwright/test';
import { seed, ledger, income, expense, category, dayIn, money } from './helpers';

/** Enough cash for a goal to be fundable, so "unspoken for" is a real number. */
const base = [category('Groceries'), income(3000, 'Salary', dayIn(-1)), expense(200, 'Groceries', dayIn(-1))];

/** Opens Plan with the goal form ready. */
async function newGoal(page: import('@playwright/test').Page, label: string, target: string, date?: string) {
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: '+ New goal' }).click();
  await page.locator('#goal-label').fill(label);
  await page.locator('#goal-target').fill(target);
  if (date) await page.locator('#goal-date').fill(date);
  await page.getByRole('button', { name: 'Create goal' }).click();
}

test.describe('savings goals', () => {
  test('creates a goal, earmarks money, and reduces what is unspoken for', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await newGoal(page, 'Emergency fund', '6000');

    await expect(page.getByText('Emergency fund')).toBeVisible();
    // Nothing set aside yet, so everything is still free.
    await expect(page.getByText(money(2800)).first()).toBeVisible();

    await page.getByLabel('Amount to move for Emergency fund').fill('500');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Earmarking moves nothing — the balance is untouched, but less of it is
    // free to spend. That distinction is the whole design of this feature.
    await expect(page.getByText(money(2300)).first()).toBeVisible();
    await expect(page.getByText(/500,00\s€ of/)).toBeVisible();

    const events = await ledger(page);
    expect(events.filter((e) => e.type === 'goal_contribution')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'income' || e.type === 'expense')).toHaveLength(2);
  });

  test('releasing money puts it back', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await newGoal(page, 'Trip', '1000');

    await page.getByLabel('Amount to move for Trip').fill('300');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(/300,00\s€ of/)).toBeVisible();

    await page.getByLabel('Amount to move for Trip').fill('100');
    await page.getByRole('button', { name: 'Release' }).click();
    await expect(page.getByText(/200,00\s€ of/)).toBeVisible();
  });

  test('says a goal is behind when the pace will not meet the deadline', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await newGoal(page, 'Deposit', '20000', `${new Date().getUTCFullYear() + 1}-12-31`);

    await page.getByLabel('Amount to move for Deposit').fill('100');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // A bar alone says "0.5%"; the required monthly figure is what makes that
    // good news or bad news.
    await expect(page.getByText(/Needs.*\/month/)).toBeVisible();
  });
});

async function newLoan(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await page.getByRole('button', { name: '+ Add loan' }).click();
  await page.locator('#debt-label').fill('Mortgage');
  await page.locator('#debt-principal').fill('200000');
  await page.locator('#debt-rate').fill('3.6');
  await page.locator('#debt-term').fill('360');
}

test.describe('debt', () => {
  test('shows the instalment before saving, then the interest the term really costs', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await newLoan(page);

    // The payment is quoted before committing, because it is the number that
    // says whether the term entered was the one intended.
    await expect(page.getByText(money(909.29))).toBeVisible();
    await page.getByRole('button', { name: 'Add loan' }).click();

    await expect(page.getByRole('term').filter({ hasText: 'Still owed' })).toBeVisible();
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByText(/in interest — that is \d+% on top/)).toBeVisible();
  });

  test('overpaying reports the months and interest it would save', async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await newLoan(page);
    await page.getByRole('button', { name: 'Add loan' }).click();
    await page.getByRole('button', { name: 'Details' }).click();

    // Default of 100 in the field: months saved and interest saved are the two
    // numbers a person can act on.
    await expect(page.getByText(/Finishes\s+\d+ months earlier/)).toBeVisible();
    await expect(page.getByText(/saves.*in interest\./)).toBeVisible();
  });

  test('debt is subtracted from net worth on the overview', async ({ page }) => {
    await seed(page, [
      ...base,
      {
        id: 'debt-1',
        type: 'debt_upsert',
        timestamp: '2026-01-01T00:00:00.000Z',
        debt: {
          id: 'd1',
          label: 'Car loan',
          principal: 10000,
          annualRate: 0,
          termMonths: 100,
          // Starts next year, so nothing has been repaid and the balance is the
          // full principal — a figure the test can state exactly.
          startDate: `${new Date().getUTCFullYear() + 1}-01-01`,
          active: true,
        },
      },
    ]);
    await page.goto('/');

    // Counting an asset while ignoring the loan against it is the easiest way
    // for this figure to lie, so the hero must say Net worth and show the debt.
    await expect(page.getByText('Net worth', { exact: true })).toBeVisible();
    await expect(page.getByText(/−10\s?000,00\s€ owed/)).toBeVisible();
    await expect(page.getByText(money(-7200)).first()).toBeVisible();
  });
});
