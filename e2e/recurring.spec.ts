import { test, expect } from '@playwright/test';
import { seed, ledger, category, monthOffset } from './helpers';

/**
 * The generator is the one part of the app that writes to the ledger on its own,
 * every time the page loads. If it is not idempotent, simply leaving the tab
 * open silently multiplies the salary — a failure the user would only notice
 * months later, in the charts. That is what this file exists to prevent.
 */
test.describe('recurring rules', () => {
  const rule = {
    id: 'rule-salary',
    type: 'recurring_upsert',
    timestamp: `${monthOffset(-3)}-01T00:00:00.000Z`,
    rule: {
      id: 'salary',
      kind: 'income',
      label: 'Monthly salary',
      amount: 1800,
      cycle: 'monthly',
      startDate: `${monthOffset(-3)}-01`,
      active: true,
    },
  };

  test('catches up the months since it started, once each', async ({ page }) => {
    await seed(page, [category('Rent'), rule]);
    await page.goto('/');

    const events = await ledger(page);
    const posted = events.filter((e) => e.type === 'income' && e.recurringId === 'salary');
    const months = posted.map((e) => String(e.timestamp).slice(0, 7)).sort();

    // Four months inclusive: three back plus the current one.
    expect(months).toEqual([monthOffset(-3), monthOffset(-2), monthOffset(-1), monthOffset(0)]);
    expect(new Set(months).size).toBe(months.length);
  });

  test('does not post again on reload', async ({ page }) => {
    await seed(page, [category('Rent'), rule]);
    await page.goto('/');
    const first = (await ledger(page)).filter((e) => e.type === 'income').length;
    expect(first).toBeGreaterThan(0);

    await page.reload();
    await page.reload();

    expect((await ledger(page)).filter((e) => e.type === 'income').length).toBe(first);
  });

  test('a deleted generated entry stays deleted', async ({ page }) => {
    await seed(page, [category('Rent'), rule]);
    await page.goto('/');
    const before = (await ledger(page)).filter((e) => e.type === 'income').length;

    await page.getByRole('button', { name: 'Entries' }).click();
    // The whole row is the control; the detail overlay is where deleting lives.
    await page.getByRole('button', { name: /^Open Monthly salary/ }).first().click();
    await page.getByRole('button', { name: 'Delete' }).click();

    // Without the skip marker, the generator would simply put it back and the
    // delete would look like it silently failed.
    await page.reload();
    const after = (await ledger(page)).filter((e) => e.type === 'income').length;
    expect(after).toBe(before - 1);
    expect((await ledger(page)).some((e) => e.type === 'recurring_skip')).toBe(true);
  });

  test('a paused rule stops posting but keeps what it already posted', async ({ page }) => {
    await seed(page, [
      category('Rent'),
      rule,
      // One month already on the books before the rule was paused.
      {
        id: 'already-posted',
        type: 'income',
        timestamp: `${monthOffset(-3)}-01T00:00:00.000Z`,
        amount: 1800,
        label: 'Monthly salary',
        recurringId: 'salary',
      },
      {
        id: 'rule-paused',
        type: 'recurring_upsert',
        timestamp: `${monthOffset(0)}-01T00:00:00.000Z`,
        rule: { ...rule.rule, active: false },
      },
    ]);
    await page.goto('/');

    // Pausing stops the future, it does not rewrite the past.
    const posted = (await ledger(page)).filter((e) => e.type === 'income' && e.recurringId === 'salary');
    expect(posted).toHaveLength(1);
    expect(String(posted[0].timestamp).slice(0, 7)).toBe(monthOffset(-3));
  });
});
