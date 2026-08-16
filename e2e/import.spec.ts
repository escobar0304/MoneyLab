import { test, expect, type Page } from '@playwright/test';
import { seed, income, expense, category, dayIn, monthOffset, ledger, money, type SeedEvent } from './helpers';

const base: SeedEvent[] = [category('Groceries'), category('Uncategorised'), income(2000, 'Salary', dayIn(0))];

/** A statement in the shape a Portuguese bank actually exports: semicolon
 * separated, day-first dates, comma decimals, a running balance column, and a
 * couple of preamble lines above the header. */
function statement(month: string): string {
  return [
    'Extrato de conta',
    'NIB: 0000 0000 0000 0000 0',
    '',
    'Data;Descricao;Valor;Saldo',
    `04-${month.slice(5)}-${month.slice(0, 4)};LIDL PORTO;-32,40;1.967,60`,
    `05-${month.slice(5)}-${month.slice(0, 4)};"CAFE, O SOL";-2,50;1.965,10`,
    `06-${month.slice(5)}-${month.slice(0, 4)};TRANSFERENCIA RECEBIDA;150,00;2.115,10`,
  ].join('\n');
}

/** Picks a file through the hidden input the button drives. */
async function upload(page: Page, name: string, contents: string) {
  await page.getByLabel('Statement file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(contents, 'utf-8') });
}

async function openEntries(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Entries', exact: true }).click();
}

test.describe('statement import', () => {
  test('reads a Portuguese bank CSV and previews it before writing anything', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('3 lines read')).toBeVisible();

    // The preamble is skipped, the header is found, and the amounts are read in
    // the European convention rather than as 3240 and 250.
    await expect(dialog.getByText('LIDL PORTO')).toBeVisible();
    await expect(dialog.getByText('CAFE, O SOL')).toBeVisible();

    // Nothing is written until the button is pressed.
    expect((await ledger(page)).filter((e) => e.note === 'LIDL PORTO')).toHaveLength(0);

    await dialog.getByRole('button', { name: /^Import 3 entries$/ }).click();

    const events = await ledger(page);
    const lidl = events.find((e) => e.note === 'LIDL PORTO');
    expect(lidl).toMatchObject({ type: 'expense', amount: 32.4, category: 'Uncategorised' });
    // A positive line is income, not a negative expense.
    expect(events.find((e) => e.label === 'TRANSFERENCIA RECEBIDA')).toMatchObject({ type: 'income', amount: 150 });
  });

  test('the rules file the import on the way in', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);

    await page.getByRole('button', { name: 'New rule' }).click();
    await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Supermarkets');
    await page.getByLabel('Condition 1 value').fill('lidl');
    await page.getByRole('dialog').getByRole('radio', { name: 'Groceries' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    const dialog = page.getByRole('dialog');
    // The whole point of importing after building rules: it arrives filed.
    await expect(dialog.getByText('1 filed by your rules')).toBeVisible();
    await dialog.getByRole('button', { name: /^Import 3 entries$/ }).click();

    expect((await ledger(page)).find((e) => e.note === 'LIDL PORTO')).toMatchObject({ category: 'Groceries' });
  });

  test('re-importing the same file adds nothing', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    await page.getByRole('dialog').getByRole('button', { name: /^Import 3 entries$/ }).click();
    const after = (await ledger(page)).length;

    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Skip 3 already in the ledger/)).toBeVisible();
    // With everything skipped there is nothing left to import.
    await expect(dialog.getByRole('button', { name: /^Import 0 entries$/ })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect((await ledger(page)).length).toBe(after);
  });

  test('a duplicate can be let through deliberately', async ({ page }) => {
    // Two identical charges on one day are real. The skip is a default, not a rule.
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    await page.getByRole('dialog').getByRole('button', { name: /^Import 3 entries$/ }).click();

    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Skip 3 already in the ledger/ }).uncheck();
    await dialog.getByRole('button', { name: /^Import 3 entries$/ }).click();

    expect((await ledger(page)).filter((e) => e.note === 'LIDL PORTO')).toHaveLength(2);
  });

  test('an already-logged expense is recognised as a duplicate', async ({ page }) => {
    // Seeded by hand, not imported — the match is on date, amount and text, so
    // it still catches the entry you typed yourself last week.
    await seed(page, [...base, expense(32.4, 'Groceries', `${monthOffset(0)}-04T12:00:00.000Z`, 'LIDL PORTO')]);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Skip 1 already in the ledger/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Import 2 entries$/ })).toBeEnabled();
  });

  test('the column mapping can be corrected by hand', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));

    const dialog = page.getByRole('dialog');
    // Pointing "Amount" at the running balance changes what the preview says,
    // which is the whole reason the mapping is shown rather than assumed.
    await dialog.getByLabel('Amount').selectOption({ label: 'Saldo' });
    await expect(dialog.getByText(money(1967.6))).toBeVisible();

    await dialog.getByLabel('Amount').selectOption({ label: 'Valor' });
    await expect(dialog.getByText('3 lines read')).toBeVisible();
  });

  test('reads an OFX file, unclosed tags and all', async ({ page }) => {
    const month = monthOffset(0).replace('-', '');
    const ofx = [
      'OFXHEADER:100',
      '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>',
      `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${month}04120000<TRNAMT>-18.90<FITID>1<NAME>FARMACIA</STMTTRN>`,
      '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
    ].join('\n');

    await seed(page, base);
    await openEntries(page);
    await page.getByLabel('Statement file').setInputFiles({ name: 'extrato.ofx', mimeType: 'application/x-ofx', buffer: Buffer.from(ofx, 'utf-8') });

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('FARMACIA')).toBeVisible();
    await dialog.getByRole('button', { name: /^Import 1 entry$/ }).click();

    expect((await ledger(page)).find((e) => e.note === 'FARMACIA')).toMatchObject({ type: 'expense', amount: 18.9 });
  });

  test('an import is one undo, not two hundred', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'extrato.csv', statement(monthOffset(0)));
    await page.getByRole('dialog').getByRole('button', { name: /^Import 3 entries$/ }).click();
    expect((await ledger(page)).filter((e) => e.note === 'LIDL PORTO')).toHaveLength(1);

    await page.getByRole('button', { name: 'Undo' }).click();
    const events = await ledger(page);
    expect(events.filter((e) => e.note === 'LIDL PORTO')).toHaveLength(0);
    expect(events.filter((e) => e.label === 'TRANSFERENCIA RECEBIDA')).toHaveLength(0);
  });

  test('refuses a file that is not a statement', async ({ page }) => {
    await seed(page, base);
    await openEntries(page);
    await upload(page, 'notes.csv', 'these are just some notes\nnothing like a statement here\n');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/Could not find any rows|Could not find a date column/)).toBeVisible();
  });
});
