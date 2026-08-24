import { test, expect } from '@playwright/test';
import { seed, ledger, income, expense, category, dayIn, monthOffset, money, type SeedEvent } from './helpers';

/** A monthly rule that has been running for a while. */
const salaryRule: SeedEvent = {
  id: 'rule-sal',
  type: 'recurring_upsert',
  timestamp: `${monthOffset(-4)}-01T00:00:00.000Z`,
  rule: {
    id: 'sal',
    kind: 'income',
    label: 'Monthly salary',
    amount: 1800,
    cycle: 'monthly',
    startDate: `${monthOffset(-4)}-25`,
    active: true,
  },
};

const rentRule: SeedEvent = {
  id: 'rule-rent',
  type: 'recurring_upsert',
  timestamp: `${monthOffset(-4)}-01T00:00:00.000Z`,
  rule: {
    id: 'rent',
    kind: 'expense',
    label: 'Rent',
    amount: 700,
    category: 'Rent',
    cycle: 'monthly',
    startDate: `${monthOffset(-4)}-01`,
    active: true,
  },
};

test.describe('the next 60 days', () => {
  test('projects a balance day by day and names the low point', async ({ page }) => {
    await seed(page, [category('Rent'), salaryRule, rentRule]);
    await page.goto('/');

    // The runway sits directly under the hero, because "do I make it to payday"
    // is the most immediate question on the page. Chart cards title themselves
    // with a paragraph, not a heading — the page has exactly one hero.
    // Exact: the summary sentence underneath also says "the next 60 days".
    await expect(page.getByText('The next 60 days', { exact: true })).toBeVisible();
    // The verdict is always stated, whatever the assumptions behind it are.
    await expect(page.getByText(/Stays positive for the next 60 days|Runs out in/)).toBeVisible();
    await expect(page.getByText(/Lowest point/)).toBeVisible();
    await expect(page.getByText(/Assumes .* a day|Scheduled items only/)).toBeVisible();
  });

  test('warns when the money runs out, with a date', async ({ page }) => {
    // Small balance, steady spending, no income coming: this must not read as
    // comfortable just because the month-end total nets out.
    const events: SeedEvent[] = [category('Groceries'), income(400, 'Salary', dayIn(-1))];
    for (let d = 0; d < 40; d++) {
      const when = new Date(Date.now() - d * 86_400_000).toISOString();
      events.push({ id: `sp-${d}`, type: 'expense', timestamp: when, amount: 8, category: 'Groceries' });
    }
    await seed(page, events);
    await page.goto('/');

    await expect(page.getByText(/Runs out in \d+ days/)).toBeVisible();
  });
});

test.describe('time travel', () => {
  test('shows the dashboard as it stood on a past date', async ({ page }) => {
    await seed(page, [
      category('Groceries'),
      income(1000, 'Salary', dayIn(-2)),
      income(1000, 'Salary', dayIn(0)),
      expense(100, 'Groceries', dayIn(0)),
    ]);
    await page.goto('/');
    await expect(page.getByText(money(1900)).first()).toBeVisible();

    // Rewind past this month's entries: only the older 1 000 should remain.
    await page.getByLabel('View the dashboard as of').fill(`${monthOffset(-1)}-15`);

    await expect(page.getByText(/Showing .* — everything below is how it stood that day/)).toBeVisible();
    await expect(page.getByText(money(1000)).first()).toBeVisible();
  });

  test('comes back to now, and never wrote anything', async ({ page }) => {
    await seed(page, [category('Groceries'), income(1000, 'Salary', dayIn(-2)), income(1000, 'Salary', dayIn(0))]);
    await page.goto('/');
    const before = (await ledger(page)).length;

    await page.getByLabel('View the dashboard as of').fill(`${monthOffset(-1)}-15`);
    await page.getByRole('button', { name: 'Back to now' }).first().click();

    await expect(page.getByText(money(2000)).first()).toBeVisible();
    // The whole feature is a filter over an append-only log — it must not have
    // recorded anything of its own.
    expect((await ledger(page)).length).toBe(before);
  });

  test('does not survive a reload, because a stale dashboard that looks live is worse', async ({ page }) => {
    await seed(page, [category('Groceries'), income(1000, 'Salary', dayIn(-2)), income(1000, 'Salary', dayIn(0))]);
    await page.goto('/');
    await page.getByLabel('View the dashboard as of').fill(`${monthOffset(-1)}-15`);
    await expect(page.getByText(/how it stood that day/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/how it stood that day/)).toHaveCount(0);
  });
});

test.describe('repeating charges', () => {
  /** The same charge four months running, the last one dearer. */
  const netflix: SeedEvent[] = [9.99, 9.99, 9.99, 12.99].map((amount, i) => ({
    id: `nf-${i}`,
    type: 'expense',
    timestamp: `${monthOffset(i - 3)}-05T10:00:00.000Z`,
    amount,
    category: 'Subscriptions',
    note: 'Netflix',
  }));

  test('finds an undeclared subscription and offers to make it a rule', async ({ page }) => {
    await seed(page, [category('Subscriptions'), ...netflix]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Repeating charges' })).toBeVisible();
    await expect(page.getByText(/without a rule/)).toBeVisible();
    // "Make it a rule" only renders for a detected, undeclared subscription.
    await expect(page.getByRole('button', { name: 'Make it a rule' })).toBeVisible();

    await page.getByRole('button', { name: 'Make it a rule' }).click();
    const rules = (await ledger(page)).filter((e) => e.type === 'recurring_upsert');
    expect(rules).toHaveLength(1);
  });

  test('catches a price rise that no chart would ever show', async ({ page }) => {
    await seed(page, [category('Subscriptions'), ...netflix]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    // Both figures are individually plausible; only the comparison is news.
    await expect(page.getByText(/Was .*9,99.*now .*12,99/)).toBeVisible();
    await expect(page.getByText(/that changed price/)).toBeVisible();
  });

  test('stays quiet about a category that repeats but never costs the same', async ({ page }) => {
    const groceries: SeedEvent[] = [41, 88, 17, 120].map((amount, i) => ({
      id: `g-${i}`,
      type: 'expense',
      timestamp: `${monthOffset(i - 3)}-05T10:00:00.000Z`,
      amount,
      category: 'Groceries',
    }));
    await seed(page, [category('Groceries'), ...groceries]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    await expect(page.getByText('Nothing repeating yet')).toBeVisible();
  });
});

test.describe('IRS deductions', () => {
  test('files a category under a heading and tracks it against the ceiling', async ({ page }) => {
    await seed(page, [category('Saúde'), expense(1000, 'Saúde', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'IRS', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'IRS deductions' })).toBeVisible();
    await page.getByLabel('Deduction heading for Saúde').selectOption('saude');

    // 15% of 1 000 = 150, against a 1 000 ceiling.
    await expect(page.getByText(money(150)).first()).toBeVisible();
    // The figure that turns a report into a decision.
    await expect(page.getByText(/more spending would still count/)).toBeVisible();
  });

  test('caps the deduction and says the ceiling was reached', async ({ page }) => {
    await seed(page, [category('Saúde'), expense(20_000, 'Saúde', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'IRS', exact: true }).click();
    await page.getByLabel('Deduction heading for Saúde').selectOption('saude');

    await expect(page.getByText('Ceiling reached')).toBeVisible();
  });

  test('lets a ceiling be corrected, because they move every budget', async ({ page }) => {
    await seed(page, [category('Saúde'), expense(20_000, 'Saúde', dayIn(0))]);
    await page.goto('/');
    await page.getByRole('button', { name: 'IRS', exact: true }).click();
    await page.getByLabel('Deduction heading for Saúde').selectOption('saude');

    await page.getByRole('button', { name: 'Edit ceiling for Saúde' }).click();
    await page.getByLabel('Ceiling for Saúde').fill('1500');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('ceiling edited').first()).toBeVisible();
    await expect(page.getByText(money(1500)).first()).toBeVisible();
  });

  test('says plainly that the figures need checking', async ({ page }) => {
    // Getting this wrong in the user's favour would be worse than not showing it.
    await seed(page, [category('Saúde')]);
    await page.goto('/');
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByText(/not an official simulation/)).toBeVisible();
  });
});
