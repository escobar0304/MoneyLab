import { test, expect } from '@playwright/test';
import { seed, category, income, expense, dayIn, type SeedEvent } from './helpers';

/** A window a fixed number of days either side of today, so the test is not
 * at the mercy of which day of the month it actually runs on. */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** An expense timestamped on the actual current date — `dayIn(0)` lands on
 * the 15th of the current month instead, which falls outside a challenge
 * window built from `daysFromNow`. */
function today(): string {
  return `${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`;
}

const runningChallenge: SeedEvent = {
  id: 'c1',
  type: 'challenge_upsert',
  timestamp: '2026-01-01T00:00:00.000Z',
  challenge: { id: 'c1', label: 'No takeaway', categories: ['Takeaway'], startDate: daysFromNow(-5), endDate: daysFromNow(10) },
};

test.describe('no-spend challenges', () => {
  test('marks today broken when an expense lands in a challenged category', async ({ page }) => {
    await seed(page, [category('Takeaway'), income(2000, 'Salary', dayIn(0)), expense(15, 'Takeaway', today()), runningChallenge]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'No-spend challenges' })).toBeVisible();
    await expect(page.getByText('No takeaway')).toBeVisible();
    await expect(page.getByText('In progress')).toBeVisible();
    await expect(page.getByText(/\d+ broken/)).toBeVisible();
  });

  test('reports every elapsed day clean when nothing was spent in the category', async ({ page }) => {
    await seed(page, [category('Takeaway'), category('Groceries'), income(2000, 'Salary', dayIn(0)), expense(40, 'Groceries', dayIn(0)), runningChallenge]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();

    // 5 days elapsed (today minus the start date), none broken.
    await expect(page.getByText('6 of 6 days clean')).toBeVisible();
    await expect(page.getByText(/broken/)).toHaveCount(0);
  });

  test('creates a new challenge by picking categories and a date range', async ({ page }) => {
    await seed(page, [category('Coffee'), category('Groceries'), income(2000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();

    await page.getByRole('button', { name: '+ New challenge' }).click();
    await page.getByLabel('Challenge').fill('No coffee runs');
    await page.getByRole('button', { name: 'Coffee', exact: true }).click();
    await page.getByLabel('Ends').fill(daysFromNow(20));
    await page.getByRole('button', { name: 'Start challenge' }).click();

    await expect(page.getByText('No coffee runs')).toBeVisible();
    // Category and dates share one text node ("Coffee · Aug 19 – Sep 8"),
    // so a partial match is needed rather than an exact one.
    await expect(page.getByText(/Coffee/)).toBeVisible();
  });

  test('removing a challenge takes it off the page', async ({ page }) => {
    await seed(page, [category('Takeaway'), income(2000, 'Salary', dayIn(0)), runningChallenge]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();

    await page.getByRole('button', { name: 'Remove No takeaway' }).click();
    await expect(page.getByText('No takeaway')).toHaveCount(0);
    await expect(page.getByText('No challenges yet')).toBeVisible();
  });
});
