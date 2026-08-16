import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  parseDelimited,
  parseAmount,
  parseDate,
  guessColumns,
  toRows,
  parseOfx,
  findDuplicates,
  rowsToEvents,
  previewImport,
  NO_COLUMN,
  type StatementRow,
} from './statements';
import { MAIN_ACCOUNT_ID } from './accounts';
import type { LedgerEvent, Rule } from './types';

describe('parseAmount', () => {
  it('reads the Portuguese convention', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('0,99')).toBe(0.99);
  });

  it('reads the English convention', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('12.50')).toBe(12.5);
  });

  it('resolves a lone separator by how many digits follow it', () => {
    // The genuinely ambiguous case. Two digits is a decimal, three is a group.
    expect(parseAmount('1,23')).toBe(1.23);
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('1.234')).toBe(1234);
    expect(parseAmount('1.23')).toBe(1.23);
  });

  it('handles signs, currency symbols and spacing', () => {
    expect(parseAmount('-45,00 €')).toBe(-45);
    expect(parseAmount('+1 200,00')).toBe(1200);
    expect(parseAmount('€ 12,00')).toBe(12);
  });

  it("reads accountants' parentheses as negative", () => {
    expect(parseAmount('(45,00)')).toBe(-45);
  });

  it('refuses anything that is not a number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('Saldo')).toBeNull();
    expect(parseAmount('12A')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads ISO', () => {
    expect(parseDate('2026-03-04')).toBe('2026-03-04');
    expect(parseDate('2026/03/04')).toBe('2026-03-04');
  });

  it('defaults to day-first, which is what banks here write', () => {
    expect(parseDate('04/03/2026')).toBe('2026-03-04');
    expect(parseDate('04-03-2026')).toBe('2026-03-04');
    expect(parseDate('04.03.2026')).toBe('2026-03-04');
  });

  it('lets an unambiguous file override the default', () => {
    // 13 cannot be a month, so this file is month-first whatever the default is.
    expect(parseDate('03/13/2026')).toBe('2026-03-13');
    // 25 cannot be a month either, so this one is day-first.
    expect(parseDate('25/03/2026')).toBe('2026-03-25');
  });

  it('expands a two-digit year', () => {
    expect(parseDate('04/03/26')).toBe('2026-03-04');
    expect(parseDate('04/03/99')).toBe('1999-03-04');
  });

  it('refuses a date that does not exist', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('45/03/2026')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('detectDelimiter', () => {
  it('is not fooled by decimal commas', () => {
    // Six commas, three semicolons — counting occurrences picks the wrong one
    // and every row collapses.
    const text = 'Data;Descricao;Valor\n04/03/2026;Lidl;-1.234,56\n05/03/2026;Cafe;-2,50\n';
    expect(detectDelimiter(text)).toBe(';');
  });

  it('finds a comma when that is the real separator', () => {
    const text = 'Date,Description,Amount\n2026-03-04,Lidl,-12.50\n2026-03-05,Cafe,-2.50\n';
    expect(detectDelimiter(text)).toBe(',');
  });

  it('finds tabs', () => {
    const text = 'Date\tDescription\tAmount\n2026-03-04\tLidl\t-12.50\n2026-03-05\tX\t-1.00\n';
    expect(detectDelimiter(text)).toBe('\t');
  });
});

describe('parseDelimited', () => {
  it('keeps quoted fields containing the delimiter in one piece', () => {
    const text = 'Data;Descricao;Valor\n04/03/2026;"LIDL, PORTO";-12,50\n';
    const table = parseDelimited(text);
    expect(table.body[0]).toEqual(['04/03/2026', 'LIDL, PORTO', '-12,50']);
  });

  it('unescapes doubled quotes', () => {
    const text = 'Data;Descricao;Valor\n04/03/2026;"CAFE ""O SOL""";-2,50\n';
    expect(parseDelimited(text).body[0][1]).toBe('CAFE "O SOL"');
  });

  it('skips the preamble banks put above the header', () => {
    // The header is not row zero on a real export, so taking row zero would
    // treat the account number as the column names.
    const text = [
      'Extrato de conta',
      'NIB: 0000 0000 0000 0000 0',
      '',
      'Data;Descricao;Valor',
      '04/03/2026;Lidl;-12,50',
      '05/03/2026;Salario;1.500,00',
    ].join('\n');
    const table = parseDelimited(text);
    expect(table.headers).toEqual(['Data', 'Descricao', 'Valor']);
    expect(table.body).toHaveLength(2);
  });
});

describe('guessColumns', () => {
  it('finds date, description and amount from the data', () => {
    const table = parseDelimited('Data;Descricao;Valor\n04/03/2026;Lidl;-12,50\n05/03/2026;Salario;1.500,00\n');
    expect(guessColumns(table)).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it('works with no header row at all', () => {
    const table = parseDelimited('04/03/2026;Lidl compras semana;-12,50\n05/03/2026;Salario mensal;1.500,00\n');
    expect(guessColumns(table)).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it('never picks the running balance as the amount', () => {
    // Both parse as money. Picking the balance makes every row wildly wrong.
    const table = parseDelimited('Data;Descricao;Valor;Saldo\n04/03/2026;Lidl;-12,50;987,50\n05/03/2026;Cafe;-2,50;985,00\n');
    expect(guessColumns(table).amount).toBe(2);
  });

  it('recognises split debit and credit columns', () => {
    const table = parseDelimited('Data;Descricao;Debito;Credito\n04/03/2026;Lidl;12,50;\n05/03/2026;Salario;;1.500,00\n');
    const map = guessColumns(table);
    expect(map.debit).toBe(2);
    expect(map.credit).toBe(3);
    expect(map.amount).toBe(NO_COLUMN);
  });
});

describe('toRows', () => {
  it('turns a signed-amount statement into rows, newest first', () => {
    const table = parseDelimited('Data;Descricao;Valor\n04/03/2026;Lidl;-12,50\n05/03/2026;Salario;1.500,00\n');
    const { rows, skipped } = toRows(table, guessColumns(table));
    expect(skipped).toBe(0);
    expect(rows).toEqual([
      { date: '2026-03-05', description: 'Salario', amount: 1500 },
      { date: '2026-03-04', description: 'Lidl', amount: -12.5 },
    ]);
  });

  it('puts the sign back on a split debit column', () => {
    // The debit column writes 12,50 as a positive. Taken at face value every
    // charge would import as income.
    const table = parseDelimited('Data;Descricao;Debito;Credito\n04/03/2026;Lidl;12,50;\n05/03/2026;Salario;;1.500,00\n');
    const { rows } = toRows(table, guessColumns(table));
    expect(rows.map((r) => r.amount)).toEqual([1500, -12.5]);
  });

  it('counts lines it cannot read rather than dropping them quietly', () => {
    const table = parseDelimited('Data;Descricao;Valor\n04/03/2026;Lidl;-12,50\n;Total do periodo;\n');
    const { rows, skipped } = toRows(table, guessColumns(table));
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('collapses runs of whitespace in the description', () => {
    const table = parseDelimited('Data;Descricao;Valor\n04/03/2026;"LIDL    PORTO   ";-12,50\n');
    expect(toRows(table, guessColumns(table)).rows[0].description).toBe('LIDL PORTO');
  });
});

describe('parseOfx', () => {
  const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260304120000<TRNAMT>-12.50<FITID>1<NAME>LIDL<MEMO>Compras</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260305<TRNAMT>1500.00<FITID>2<NAME>SALARIO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it('reads unclosed SGML tags, which every real file has', () => {
    const rows = parseOfx(ofx);
    expect(rows).toEqual([
      { date: '2026-03-05', description: 'SALARIO', amount: 1500 },
      { date: '2026-03-04', description: 'LIDL · Compras', amount: -12.5 },
    ]);
  });

  it('returns nothing for a file with no transactions', () => {
    expect(parseOfx('<OFX></OFX>')).toEqual([]);
  });
});

describe('findDuplicates', () => {
  const rows: StatementRow[] = [
    { date: '2026-03-04', description: 'Lidl', amount: -12.5 },
    { date: '2026-03-05', description: 'Salario', amount: 1500 },
  ];

  it('finds nothing against an empty ledger', () => {
    expect(findDuplicates(rows, [])).toEqual(new Set());
  });

  it('recognises entries a previous import created', () => {
    const events: LedgerEvent[] = [
      { id: 'a', type: 'expense', timestamp: '2026-03-04T12:00:00.000Z', amount: 12.5, category: 'Uncategorised', note: 'Lidl' },
      { id: 'b', type: 'income', timestamp: '2026-03-05T12:00:00.000Z', amount: 1500, label: 'Salario' },
    ];
    expect(findDuplicates(rows, events)).toEqual(new Set([0, 1]));
  });

  it('matches one row per existing entry, so a genuinely repeated charge still comes through', () => {
    // Two coffees at 2,50 on the same day are two transactions. A plain set
    // would silently drop the second on every import.
    const twice: StatementRow[] = [
      { date: '2026-03-04', description: 'Cafe', amount: -2.5 },
      { date: '2026-03-04', description: 'Cafe', amount: -2.5 },
    ];
    const events: LedgerEvent[] = [
      { id: 'a', type: 'expense', timestamp: '2026-03-04T12:00:00.000Z', amount: 2.5, category: 'Uncategorised', note: 'Cafe' },
    ];
    expect(findDuplicates(twice, events)).toEqual(new Set([0]));
  });

  it('sees through case and accent differences between exports', () => {
    const events: LedgerEvent[] = [
      { id: 'a', type: 'expense', timestamp: '2026-03-04T12:00:00.000Z', amount: 12.5, category: 'X', note: 'LIDL' },
    ];
    expect(findDuplicates([{ date: '2026-03-04', description: 'lidl', amount: -12.5 }], events)).toEqual(new Set([0]));
  });

  it('does not confuse a different amount on the same day', () => {
    const events: LedgerEvent[] = [
      { id: 'a', type: 'expense', timestamp: '2026-03-04T12:00:00.000Z', amount: 99, category: 'X', note: 'Lidl' },
    ];
    expect(findDuplicates([{ date: '2026-03-04', description: 'Lidl', amount: -12.5 }], events)).toEqual(new Set());
  });
});

describe('rowsToEvents', () => {
  const rows: StatementRow[] = [
    { date: '2026-03-04', description: 'Lidl compras', amount: -12.5 },
    { date: '2026-03-05', description: 'Salario', amount: 1500 },
  ];

  it('splits by sign into expenses and income', () => {
    const events = rowsToEvents(rows, { defaultCategory: 'Uncategorised', rules: [] });
    expect(events[0]).toMatchObject({ type: 'expense', amount: 12.5, category: 'Uncategorised', note: 'Lidl compras' });
    expect(events[1]).toMatchObject({ type: 'income', amount: 1500, label: 'Salario' });
  });

  it('dates entries at midday, not midnight', () => {
    // Midnight UTC is the previous day anywhere east of Greenwich, which would
    // file part of every import into the wrong month.
    expect(rowsToEvents(rows, { defaultCategory: 'X', rules: [] })[0].timestamp).toBe('2026-03-04T12:00:00.000Z');
  });

  it('applies the rules on the way in', () => {
    const rule: Rule = {
      id: 'r',
      label: 'Supermarkets',
      active: true,
      appliesTo: 'expense',
      conditions: [{ field: 'text', op: 'contains', value: 'lidl' }],
      actions: { category: 'Groceries' },
    };
    const events = rowsToEvents(rows, { defaultCategory: 'Uncategorised', rules: [rule] });
    expect(events[0]).toMatchObject({ category: 'Groceries' });
    expect(events[1]).toMatchObject({ type: 'income' });
  });

  it('files everything into the chosen account, leaving main implicit', () => {
    const toSavings = rowsToEvents(rows, { defaultCategory: 'X', rules: [], accountId: 'sav' });
    expect(toSavings[0].accountId).toBe('sav');
    const toMain = rowsToEvents(rows, { defaultCategory: 'X', rules: [], accountId: MAIN_ACCOUNT_ID });
    expect(toMain[0].accountId).toBeUndefined();
  });

  it('names an unlabelled deposit rather than leaving it blank', () => {
    const events = rowsToEvents([{ date: '2026-03-05', description: '', amount: 20 }], { defaultCategory: 'X', rules: [] });
    expect(events[0]).toMatchObject({ type: 'income', label: 'Deposit' });
  });
});

describe('previewImport', () => {
  it('reports what each row would become and whether it is already there', () => {
    const rows: StatementRow[] = [
      { date: '2026-03-04', description: 'Lidl', amount: -12.5 },
      { date: '2026-03-06', description: 'Cafe', amount: -2.5 },
    ];
    const events: LedgerEvent[] = [
      { id: 'a', type: 'expense', timestamp: '2026-03-04T12:00:00.000Z', amount: 12.5, category: 'Uncategorised', note: 'Lidl' },
    ];
    const preview = previewImport(rows, events, { defaultCategory: 'Uncategorised', rules: [] });
    expect(preview.map((p) => p.duplicate)).toEqual([true, false]);
    expect(preview[1].event).toMatchObject({ type: 'expense', amount: 2.5 });
  });
});
