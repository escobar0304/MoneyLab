import { test, expect } from '@playwright/test';
import { seed, ledger, income, expense, category, dayIn, money, openEntries } from './helpers';

/** Two months apart, so a search that only looked at the visible month would
 * miss half of it — which is the point of searching at all. */
const base = [
  category('Saúde'),
  category('Alimentação'),
  income(1800, 'Salary', dayIn(0)),
  expense(60, 'Saúde', dayIn(-3), 'Dentista'),
  expense(35, 'Saúde', dayIn(0), 'Dentista consulta'),
  expense(42.5, 'Alimentação', dayIn(0), 'Supermercado'),
];

test.describe('searching entries', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();
  });

  test('reaches months that are not on screen', async ({ page }) => {
    // Only one of the two dentist charges is in the month shown by default.
    await expect(page.getByRole('button', { name: /^Open Saúde/ })).toHaveCount(1);

    await page.getByLabel('Search entries').fill('dentista');
    await expect(page.getByText('2 matches across all months')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open Saúde/ })).toHaveCount(2);
  });

  test('ignores accents, so the hardest words to type still work', async ({ page }) => {
    await page.getByLabel('Search entries').fill('saude');
    await expect(page.getByText('2 matches across all months')).toBeVisible();
  });

  test('finds an entry by its amount', async ({ page }) => {
    await page.getByLabel('Search entries').fill('42,5');
    await expect(page.getByText('1 match across all months')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open Alimentação/ })).toBeVisible();
  });

  test('narrows as terms are added, and says so when nothing matches', async ({ page }) => {
    const box = page.getByLabel('Search entries');
    await box.fill('dentista');
    await expect(page.getByText('2 matches across all months')).toBeVisible();
    await box.fill('dentista consulta');
    await expect(page.getByText('1 match across all months')).toBeVisible();
    await box.fill('dentista raio-x');
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test('the month picker steps aside while searching, and comes back after', async ({ page }) => {
    // Exact: "Monthly budget for …" also contains "Month".
    const monthPicker = page.getByLabel('Month', { exact: true });
    await page.getByLabel('Search entries').fill('dentista');
    await expect(monthPicker).toBeDisabled();

    await page.getByLabel('Search entries').fill('');
    await expect(monthPicker).toBeEnabled();
  });
});

test.describe('renaming and merging categories', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, [...base, { id: 'b1', type: 'budget_set', timestamp: dayIn(-1), category: 'Saúde', amount: 100 }]);
    await page.goto('/');
  });

  test('renames everywhere at once — entries, picker and budget', async ({ page }) => {
    await openEntries(page, 'manage');
    await page.getByRole('button', { name: 'Rename Saúde' }).click();
    await page.getByLabel('Rename Saúde').fill('Health');
    await page.getByRole('button', { name: 'Save' }).click();

    // The entries list stays on screen through the whole flow — it picks up
    // the rename without needing Log/Manage to switch at all.
    await expect(page.getByRole('button', { name: /^Open Health/ })).toHaveCount(1);

    // The picker in the expense form is the other surface, on Log.
    await openEntries(page, 'log');
    await expect(page.getByRole('radio', { name: 'Health' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Saúde' })).toHaveCount(0);

    const events = await ledger(page);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Saúde')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Health')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'budget_set' && e.category === 'Health')).toHaveLength(1);
  });

  test('renaming onto an existing category merges, after saying what that means', async ({ page }) => {
    await openEntries(page, 'manage');
    await page.getByRole('button', { name: 'Rename Saúde' }).click();
    await page.getByLabel('Rename Saúde').fill('Alimentação');
    await page.getByRole('button', { name: 'Save' }).click();

    // A merge is not undone by renaming back, so it is confirmed first.
    await expect(page.getByText(/entries in.*Saúde.*move to/)).toBeVisible();
    await expect(page.getByText(/budget of.*is dropped/)).toBeVisible();
    await page.getByRole('button', { name: 'Merge', exact: true }).click();

    await openEntries(page, 'log');
    await expect(page.getByRole('radio', { name: 'Saúde' })).toHaveCount(0);
    const events = await ledger(page);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Alimentação')).toHaveLength(3);
    // The target keeps its own budget, and the source's is gone rather than
    // silently overwriting it.
    expect(events.filter((e) => e.type === 'budget_set')).toHaveLength(0);
  });

  test('survives a reload, because it rewrote the ledger rather than the view', async ({ page }) => {
    await openEntries(page, 'manage');
    await page.getByRole('button', { name: 'Rename Saúde' }).click();
    await page.getByLabel('Rename Saúde').fill('Health');
    await page.getByRole('button', { name: 'Save' }).click();

    // A fresh load starts back on Log, same as any first visit.
    await page.reload();
    await page.getByRole('button', { name: 'Entries', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Health' })).toBeVisible();
  });

  test('points out two names that are the same word twice', async ({ page }) => {
    // Creating a category happens on Log, through the expense form's picker —
    // Manage's list has nothing to rename until one already exists.
    await openEntries(page, 'log');
    await page.getByRole('button', { name: '+ New', exact: true }).click();
    await page.getByLabel('New category name').fill('saude');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await openEntries(page, 'manage');
    await expect(page.getByText('looks like a duplicate')).toHaveCount(2);
  });
});

test.describe('reconciling against the bank', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();
    await page.getByRole('button', { name: 'Select' }).click();
  });

  test('ticking entries moves them from uncleared to cleared', async ({ page }) => {
    await page.getByLabel(/^Select Salary/).check();
    await page.getByRole('button', { name: 'Mark cleared' }).click();
    await expect(page.getByText(money(1800)).first()).toBeVisible();

    expect((await ledger(page)).filter((e) => e.type === 'entry_cleared' && e.cleared === true)).toHaveLength(1);
  });

  test('says plainly when the cleared figure matches the bank', async ({ page }) => {
    await page.getByRole('button', { name: 'Select all shown' }).click();
    await page.getByRole('button', { name: 'Mark cleared' }).click();
    // Everything in this month: 1800 − 35 − 42.50 = 1722.50.
    await page.locator('#bank-balance').fill('1722,50');
    await expect(page.getByText('Matches — nothing missing.')).toBeVisible();
  });

  test('names the size and the direction of a mismatch', async ({ page }) => {
    await page.getByRole('button', { name: 'Select all shown' }).click();
    await page.getByRole('button', { name: 'Mark cleared' }).click();
    await page.locator('#bank-balance').fill('1700');
    await expect(page.getByText(/Off by/)).toBeVisible();
    await expect(page.getByText(/you logged more than the bank has/)).toBeVisible();
  });

  test('un-ticking works and the tick survives a reload', async ({ page }) => {
    await page.getByLabel(/^Select Salary/).check();
    await page.getByRole('button', { name: 'Mark cleared' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Entries', exact: true }).click();

    // The tick stays visible outside selection mode, so a verified ledger looks
    // different from one nobody has checked.
    await expect(page.getByRole('img', { name: 'Cleared' })).toHaveCount(1);

    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByLabel(/^Select Salary/).check();
    await page.getByRole('button', { name: 'Unmark' }).click();
    await expect(page.getByRole('img', { name: 'Cleared' })).toHaveCount(0);
  });
});

test.describe('bulk editing', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Entries', exact: true }).click();
    await page.getByRole('button', { name: 'Select' }).click();
  });

  test('moves several entries to another category at once', async ({ page }) => {
    // Correcting the category name is one thing; moving ten misfiled expenses
    // is the other half, and it was only possible one row at a time.
    await page.getByLabel(/^Select Saúde/).check();
    await page.getByRole('button', { name: 'Recategorise' }).click();

    // Scoped to the dialog: the expense form behind it has the same picker.
    await page.getByRole('dialog').getByRole('radio', { name: 'Alimentação' }).click();
    await page.getByRole('button', { name: 'Move them' }).click();

    const events = await ledger(page);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Alimentação')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'expense' && e.category === 'Saúde')).toHaveLength(1);
  });

  test('leaves income alone, because it has no category', async ({ page }) => {
    await page.getByRole('button', { name: 'Select all shown' }).click();
    await page.getByRole('button', { name: 'Recategorise' }).click();
    await expect(page.getByText(/Income entries in the selection are left alone/)).toBeVisible();
    await page.getByRole('dialog').getByRole('radio', { name: 'Alimentação' }).click();
    await page.getByRole('button', { name: 'Move them' }).click();

    const events = await ledger(page);
    expect(events.filter((e) => e.type === 'income')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'income' && 'category' in e)).toHaveLength(0);
  });

  test('deletes a selection behind a confirmation, and it can be undone', async ({ page }) => {
    await page.getByRole('button', { name: 'Select all shown' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete them' }).click();

    expect((await ledger(page)).filter((e) => e.type === 'expense' || e.type === 'income')).toHaveLength(1);

    await page.keyboard.press('Control+z');
    expect((await ledger(page)).filter((e) => e.type === 'expense' || e.type === 'income')).toHaveLength(4);
  });

  test('does nothing until something is selected', async ({ page }) => {
    await expect(page.getByText('Nothing selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recategorise' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
  });
});
