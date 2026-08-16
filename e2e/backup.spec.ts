import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seed, ledger, income, expense, category, dayIn } from './helpers';

const base = [category('Groceries'), income(1800, 'Salary', dayIn(0)), expense(42.5, 'Groceries', dayIn(0), 'Secret shop')];

/**
 * Backups are the one feature whose failure is silent and total: you only find
 * out the file was unreadable on the day you need it. So this round-trips a real
 * download back through the real import, rather than testing the crypto in
 * isolation — the unit tests already do that.
 */
test.describe('encrypted backup', () => {
  test('round-trips a ledger through an encrypted file', async ({ page }, testInfo) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

    await page.getByRole('button', { name: 'Export encrypted' }).click();
    await page.locator('#export-pass').fill('a properly long passphrase');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Encrypt and download' }).click();
    const download = await downloadPromise;

    const file = testInfo.outputPath('backup.encrypted.json');
    await download.saveAs(file);
    const contents = await readFile(file, 'utf8');

    // Nothing readable in the file is the entire point.
    expect(contents).not.toContain('Secret shop');
    expect(contents).not.toContain('Groceries');
    expect(JSON.parse(contents)).toMatchObject({ moneylab: 'encrypted', cipher: 'AES-GCM' });

    // Wipe, then restore from the file.
    await page.getByRole('button', { name: 'Clear all data' }).click();
    await page.getByRole('button', { name: 'Delete everything' }).click();
    expect((await ledger(page)).length).toBe(0);

    // The visible control is a button that forwards the click; the real input is
    // hidden, so files go to the input directly.
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByText('This backup is encrypted')).toBeVisible();
    await page.locator('#import-pass').fill('a properly long passphrase');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await page.getByRole('button', { name: 'Merge' }).click();
    const restored = await ledger(page);
    expect(restored.filter((e) => e.type === 'expense' && e.note === 'Secret shop')).toHaveLength(1);
  });

  test('rejects the wrong passphrase instead of importing garbage', async ({ page }, testInfo) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

    await page.getByRole('button', { name: 'Export encrypted' }).click();
    await page.locator('#export-pass').fill('a properly long passphrase');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Encrypt and download' }).click();
    const file = testInfo.outputPath('backup.encrypted.json');
    await (await downloadPromise).saveAs(file);

    // The visible control is a button that forwards the click; the real input is
    // hidden, so files go to the input directly.
    await page.locator('input[type=file]').setInputFiles(file);
    await page.locator('#import-pass').fill('definitely not it');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page.getByText('Wrong passphrase, or the file has been altered.')).toBeVisible();
  });

  test('a plain export still imports, so old backups keep working', async ({ page }, testInfo) => {
    await seed(page, base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const file = testInfo.outputPath('backup.json');
    await (await downloadPromise).saveAs(file);

    // The visible control is a button that forwards the click; the real input is
    // hidden, so files go to the input directly.
    await page.locator('input[type=file]').setInputFiles(file);
    // Every event is already present, so the merge preview must say so rather
    // than offering to duplicate the whole ledger.
    await expect(page.getByText(/skips \d+ already here/)).toBeVisible();
    await page.getByRole('button', { name: 'Merge' }).click();
    await expect(page.getByText(/0 new entries added/)).toBeVisible();
  });
});
