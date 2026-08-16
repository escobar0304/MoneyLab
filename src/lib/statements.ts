import type { LedgerEvent, MoneyEvent, Rule, ID } from './types';
import { isMoneyEvent } from './types';
import { fold } from './search';
import { applyRules } from './rules';
import { accountIdOf, MAIN_ACCOUNT_ID } from './accounts';
import { makeId } from './id';

/** One line of a bank statement, normalised. */
export interface StatementRow {
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  /** Signed: negative is money leaving the account. */
  amount: number;
}

export interface ParsedTable {
  headers: string[];
  body: string[][];
  delimiter: string;
}

/** Which column holds what. `debit`/`credit` cover the banks that split the
 * amount across two columns instead of signing one. */
export interface ColumnMap {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
}

export const NO_COLUMN = -1;

const CANDIDATE_DELIMITERS = [';', ',', '\t', '|'];

/**
 * Picks the separator by parsing with each and seeing which produces a
 * consistent, wide table.
 *
 * Counting raw occurrences is not enough: a Portuguese statement full of
 * "1.234,56" has more commas than semicolons, so the naive count picks the
 * decimal separator and every row collapses into nonsense.
 */
export function detectDelimiter(text: string): string {
  let best = ';';
  let bestScore = -1;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const rows = tokenize(text, delimiter).filter((r) => r.some((c) => c.trim() !== ''));
    if (rows.length === 0) continue;
    const widths = rows.slice(0, 20).map((r) => r.length);
    const modal = widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)];
    if (modal < 2) continue;
    // Reward width, punish rows that disagree about it.
    const consistent = widths.filter((w) => w === modal).length / widths.length;
    const score = modal * consistent;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** A real CSV tokenizer: quoted fields may contain the delimiter and newlines,
 * and `""` is an escaped quote. A line-by-line split gets all three wrong. */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Splits a delimited file into a header and its data rows.
 *
 * Bank exports routinely open with a few lines of preamble — account number,
 * period, a blank line — so the header is not row zero. It is found instead as
 * the last row before the data starts, where "data" means rows that carry a
 * parseable date.
 */
export function parseDelimited(text: string, delimiter?: string): ParsedTable {
  const d = delimiter ?? detectDelimiter(text);
  const all = tokenize(text, d)
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''));

  const firstData = all.findIndex((r) => r.some((c) => parseDate(c) !== null) && r.some((c) => parseAmount(c) !== null));
  if (firstData === -1) {
    return { headers: all[0] ?? [], body: all.slice(1), delimiter: d };
  }

  const headerRow = firstData > 0 ? all[firstData - 1] : [];
  const width = Math.max(...all.slice(firstData).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => headerRow[i] ?? `Column ${i + 1}`);
  return { headers, body: all.slice(firstData), delimiter: d };
}

/**
 * Reads a money figure written in any of the conventions a bank might use.
 *
 * The hard case is a lone separator: "1,234" is twelve hundred in English and
 * one-and-a-bit in Portuguese. Resolved by digit count — a separator followed by
 * exactly one or two digits is a decimal point, three is a thousands group —
 * which is right for every real amount and only ambiguous for figures no
 * statement contains.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[\s ]/g, '').replace(/[€$£]/g, '');
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true; // accountants' parentheses
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);

  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decimal = '';

  if (lastComma >= 0 && lastDot >= 0) {
    decimal = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimal = s.length - lastComma - 1 <= 2 && s.split(',').length === 2 ? ',' : '';
  } else if (lastDot >= 0) {
    decimal = s.length - lastDot - 1 <= 2 && s.split('.').length === 2 ? '.' : '';
  }

  const cleaned = decimal === '' ? s.replace(/[.,]/g, '') : s.replace(new RegExp(`[.,](?![^.,]*$)`, 'g'), '').replace(decimal, '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Reads a date and returns it as YYYY-MM-DD, or null.
 *
 * Day-first is the default when both halves could be either, because that is
 * what banks in Portugal write. An unambiguous file still wins: a first part
 * above twelve can only be a day, and a second part above twelve can only be a
 * day too, which makes that file month-first whatever the default says.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (s === '') return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    return isRealDate(y, m, d) ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  }

  const parts = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  let year = Number(parts[3]);
  if (parts[3].length === 2) year += year < 70 ? 2000 : 1900;

  const monthFirst = first <= 12 && second > 12;
  const day = monthFirst ? second : first;
  const month = monthFirst ? first : second;
  return isRealDate(year, month, day) ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

const DATE_WORDS = /data|date|dt\b|movimento|valor.?dat/i;
const AMOUNT_WORDS = /valor|montante|amount|import|quantia/i;
const DEBIT_WORDS = /d[ée]bito|debit|levantament|sa[ií]da|withdraw/i;
const CREDIT_WORDS = /cr[ée]dito|credit|entrada|dep[óo]sit/i;
const DESCRIPTION_WORDS = /descri|hist[óo]ric|movimento|detalhe|concept|memo|name|refer/i;
const BALANCE_WORDS = /saldo|balance/i;

/** How many rows of a column parse as the given kind, counting every row. */
function parsedCount(body: string[][], column: number, parse: (v: string) => unknown): number {
  if (column < 0) return 0;
  let hits = 0;
  for (const row of body) if (row[column] !== undefined && parse(row[column]) !== null) hits++;
  return hits;
}

/**
 * How many *filled* cells of a column parse as the given kind.
 *
 * Blank cells are excluded rather than counted as misses, because a bank that
 * splits the amount across Debit and Credit leaves one of them empty on every
 * single line — so a rate measured over all rows can never exceed a half, and
 * the two columns that carry all the money score as if they carried none.
 */
function filledParseRate(body: string[][], column: number, parse: (v: string) => unknown): number {
  if (column < 0) return 0;
  let filled = 0;
  let hits = 0;
  for (const row of body) {
    const cell = row[column];
    if (cell === undefined || cell.trim() === '') continue;
    filled++;
    if (parse(cell) !== null) hits++;
  }
  return filled === 0 ? 0 : hits / filled;
}

/**
 * Guesses which column is which, from the data first and the headings second.
 *
 * Header names are a hint, not the answer: they are in whatever language and
 * abbreviation the bank chose, and plenty of exports have no header row at all.
 * What every statement does have is a column that parses as dates and one that
 * parses as money, and that is what this leans on.
 */
export function guessColumns(table: ParsedTable): ColumnMap {
  const { headers, body } = table;
  const width = Math.max(headers.length, ...body.map((r) => r.length), 0);
  const indices = Array.from({ length: width }, (_, i) => i);
  const header = (i: number) => headers[i] ?? '';

  // Whichever column carries the most dates, rather than one clearing a fixed
  // bar: a trailing "Total" line with no date is normal, and a threshold strict
  // enough to reject junk columns also rejects a good one on a short file.
  // Nothing else on a statement parses as a date, so the maximum is safe.
  const dateScores = indices.map((i) => parsedCount(body, i, parseDate) / Math.max(body.length, 1) + (DATE_WORDS.test(header(i)) ? 0.3 : 0));
  const anyDates = indices.some((i) => parsedCount(body, i, parseDate) > 0);
  const date = anyDates ? dateScores.indexOf(Math.max(...dateScores)) : NO_COLUMN;

  // The running balance also parses as money, and picking it would turn every
  // row into a wildly wrong amount — so it is excluded by name before scoring.
  const numeric = indices.filter((i) => i !== date && filledParseRate(body, i, parseAmount) > 0.6);
  const spendable = numeric.filter((i) => !BALANCE_WORDS.test(header(i)));

  const debit = spendable.find((i) => DEBIT_WORDS.test(header(i))) ?? NO_COLUMN;
  const credit = spendable.find((i) => CREDIT_WORDS.test(header(i))) ?? NO_COLUMN;

  let amount = NO_COLUMN;
  if (debit === NO_COLUMN || credit === NO_COLUMN) {
    const named = spendable.find((i) => AMOUNT_WORDS.test(header(i)));
    // Otherwise the column that actually carries both directions — a single
    // signed amount column always does, a fee-only column never does.
    const signed = spendable.find((i) => body.some((r) => (parseAmount(r[i] ?? '') ?? 0) < 0));
    amount = named ?? signed ?? spendable[0] ?? NO_COLUMN;
  }

  const used = new Set([date, amount, debit, credit].filter((i) => i !== NO_COLUMN));
  const namedDescription = indices.find((i) => !used.has(i) && DESCRIPTION_WORDS.test(header(i)));
  // Failing a name, the wordiest column: a description is the only free text on
  // a statement line.
  const widest = indices
    .filter((i) => !used.has(i))
    .map((i) => ({ i, len: body.reduce((sum, r) => sum + (r[i]?.length ?? 0), 0) }))
    .sort((a, b) => b.len - a.len)[0]?.i;

  return { date, description: namedDescription ?? widest ?? NO_COLUMN, amount, debit, credit };
}

export interface RowResult {
  rows: StatementRow[];
  /** Lines that had no usable date or amount — reported rather than dropped
   * silently, because a statement half-imported is worse than one refused. */
  skipped: number;
}

export function toRows(table: ParsedTable, map: ColumnMap): RowResult {
  const rows: StatementRow[] = [];
  let skipped = 0;

  for (const raw of table.body) {
    const date = map.date === NO_COLUMN ? null : parseDate(raw[map.date] ?? '');
    let amount: number | null = null;

    if (map.debit !== NO_COLUMN || map.credit !== NO_COLUMN) {
      const out = map.debit === NO_COLUMN ? null : parseAmount(raw[map.debit] ?? '');
      const inn = map.credit === NO_COLUMN ? null : parseAmount(raw[map.credit] ?? '');
      // Split columns write the debit as a positive number in the debit column;
      // the sign has to be put back or every charge would read as income.
      if (out !== null && out !== 0) amount = -Math.abs(out);
      else if (inn !== null && inn !== 0) amount = Math.abs(inn);
    } else if (map.amount !== NO_COLUMN) {
      amount = parseAmount(raw[map.amount] ?? '');
    }

    const description = (map.description === NO_COLUMN ? '' : (raw[map.description] ?? '')).replace(/\s+/g, ' ').trim();

    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    rows.push({ date, description, amount: Math.round(amount * 100) / 100 });
  }

  // Newest first, matching every other list of entries in the app.
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { rows, skipped };
}

/**
 * Reads an OFX/QFX file.
 *
 * Parsed with regexes over the transaction blocks rather than as XML on
 * purpose: OFX is SGML, its tags are routinely left unclosed, and every real
 * file from a bank fails an XML parser.
 */
export function parseOfx(text: string): StatementRow[] {
  const rows: StatementRow[] = [];
  const value = (block: string, tag: string): string => {
    const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
    return m ? m[1].trim() : '';
  };

  for (const [, block] of text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const stamp = value(block, 'DTPOSTED');
    const amount = parseAmount(value(block, 'TRNAMT').replace(',', '.'));
    if (stamp.length < 8 || amount === null || amount === 0) continue;

    const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
    if (parseDate(date) === null) continue;

    const name = value(block, 'NAME');
    const memo = value(block, 'MEMO');
    rows.push({
      date,
      description: [name, memo].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim(),
      amount: Math.round(amount * 100) / 100,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

/** What makes two lines "the same transaction". Description is folded and
 * clipped so a bank that pads or re-cases its text between exports still
 * matches. */
function fingerprint(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${fold(description).replace(/\s+/g, ' ').slice(0, 40)}`;
}

function entryFingerprint(e: MoneyEvent): string {
  const description = e.type === 'income' ? e.label : (e.note ?? e.category);
  const signed = e.type === 'income' ? e.amount : -e.amount;
  return fingerprint(e.timestamp.slice(0, 10), signed, description);
}

/**
 * Which rows are already in the ledger, by index.
 *
 * Counted rather than set-tested: two coffees at €2.50 on the same day are two
 * real transactions, and a plain set would silently drop the second every time
 * the statement was re-imported. Matching one row per existing entry means
 * re-importing the same file adds nothing, while a genuinely repeated charge
 * still comes through.
 */
export function findDuplicates(rows: StatementRow[], events: LedgerEvent[]): Set<number> {
  const available = new Map<string, number>();
  for (const e of events) {
    if (!isMoneyEvent(e)) continue;
    const key = entryFingerprint(e);
    available.set(key, (available.get(key) ?? 0) + 1);
  }

  const duplicates = new Set<number>();
  rows.forEach((row, i) => {
    const key = fingerprint(row.date, row.amount, row.description);
    const left = available.get(key) ?? 0;
    if (left > 0) {
      duplicates.add(i);
      available.set(key, left - 1);
    }
  });
  return duplicates;
}

export interface ImportOptions {
  accountId?: ID;
  /** Where an expense lands when no rule claims it. */
  defaultCategory: string;
  rules: Rule[];
}

/**
 * Turns statement lines into ledger events, with the rules applied.
 *
 * The rules run here rather than at the form, which is the whole reason import
 * is worth building now: two hundred lines arrive already filed instead of two
 * hundred lines arriving as homework.
 */
export function rowsToEvents(rows: StatementRow[], options: ImportOptions): MoneyEvent[] {
  const { accountId, defaultCategory, rules } = options;
  const account = accountId && accountId !== MAIN_ACCOUNT_ID ? accountId : undefined;

  return rows.map((row) => {
    // Midday, not midnight: a statement carries a date and no time, and midnight
    // UTC is the previous day for anyone east of Greenwich — which would file
    // half the import into the wrong month.
    const timestamp = `${row.date}T12:00:00.000Z`;
    const base: MoneyEvent =
      row.amount >= 0
        ? { id: makeId(), type: 'income', timestamp, amount: row.amount, label: row.description || 'Deposit', accountId: account }
        : {
            id: makeId(),
            type: 'expense',
            timestamp,
            amount: Math.abs(row.amount),
            category: defaultCategory,
            note: row.description || undefined,
            accountId: account,
          };
    return applyRules(base, rules);
  });
}

/** A preview line: the row, what it would become, and why it might not. */
export interface ImportPreviewRow {
  row: StatementRow;
  event: MoneyEvent;
  duplicate: boolean;
  accountId: ID;
}

export function previewImport(rows: StatementRow[], events: LedgerEvent[], options: ImportOptions): ImportPreviewRow[] {
  const duplicates = findDuplicates(rows, events);
  const built = rowsToEvents(rows, options);
  return rows.map((row, i) => ({
    row,
    event: built[i],
    duplicate: duplicates.has(i),
    accountId: accountIdOf(built[i]),
  }));
}
