import { useMemo, useRef, useState } from 'react';
import { useStore, useAccounts, useRules, useCategories } from '../../lib/store';
import { MAIN_ACCOUNT_ID } from '../../lib/accounts';
import {
  parseDelimited,
  parseOfx,
  guessColumns,
  toRows,
  previewImport,
  NO_COLUMN,
  type ColumnMap,
  type ParsedTable,
  type StatementRow,
} from '../../lib/statements';
import { formatMoney, formatDate } from '../../lib/format';
import { Button, Card, Label, Modal, SectionTitle, Select } from '../ui/primitives';

const UNCATEGORISED = 'Uncategorised';

/** A file the user picked, already read and parsed as far as it can be. */
interface Loaded {
  name: string;
  /** Absent for OFX — it has no columns to map. */
  table: ParsedTable | null;
  map: ColumnMap;
  /** Set directly for OFX, derived from table+map for CSV. */
  ofxRows: StatementRow[] | null;
}

/**
 * Reads a bank statement into the ledger.
 *
 * The reason this is worth having *now* rather than earlier: on its own an
 * import turns a file into two hundred uncategorised rows, which is not less
 * work than typing them, only faster and more boring. With the rules engine in
 * front of it and accounts behind it, the same file lands already filed and in
 * the right pot — so the import removes the work instead of relocating it.
 *
 * Nothing is written until the preview has been seen. An import is the one
 * action in the app that can add hundreds of events at once, and it is the one
 * place where "show it before you do it" earns its keep most.
 */
export function StatementImport() {
  const events = useStore((s) => s.events);
  const importStatement = useStore((s) => s.importStatement);
  const accounts = useAccounts();
  const rules = useRules();
  const categories = useCategories();

  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(MAIN_ACCOUNT_ID);
  const [defaultCategory, setDefaultCategory] = useState(UNCATEGORISED);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const parsed = useMemo(() => {
    if (!loaded) return { rows: [] as StatementRow[], skipped: 0 };
    if (loaded.ofxRows) return { rows: loaded.ofxRows, skipped: 0 };
    if (!loaded.table) return { rows: [] as StatementRow[], skipped: 0 };
    return toRows(loaded.table, loaded.map);
  }, [loaded]);

  const preview = useMemo(
    () => previewImport(parsed.rows, events, { accountId, defaultCategory, rules }),
    [parsed.rows, events, accountId, defaultCategory, rules]
  );

  const duplicates = preview.filter((p) => p.duplicate).length;
  const willImport = skipDuplicates ? preview.filter((p) => !p.duplicate) : preview;
  const categorised = willImport.filter((p) => p.event.type === 'expense' && p.event.category !== defaultCategory).length;

  const read = async (file: File) => {
    setError(null);
    setDone(null);
    const text = await file.text();

    if (/\.ofx$|\.qfx$/i.test(file.name) || /<STMTTRN>/i.test(text)) {
      const rows = parseOfx(text);
      if (rows.length === 0) {
        setError('No transactions found in that OFX file.');
        return;
      }
      setLoaded({ name: file.name, table: null, map: blankMap(), ofxRows: rows });
      return;
    }

    const table = parseDelimited(text);
    if (table.body.length === 0) {
      setError('Could not find any rows in that file. It may not be a statement export.');
      return;
    }
    const map = guessColumns(table);
    if (map.date === NO_COLUMN) {
      setError('Could not find a date column. Check that the file is a statement and not a summary.');
      return;
    }
    setLoaded({ name: file.name, table, map, ofxRows: null });
  };

  const close = () => {
    setLoaded(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const run = () => {
    const count = importStatement(
      willImport.map((p) => p.row),
      { accountId, defaultCategory }
    );
    setDone(`${count} ${count === 1 ? 'entry' : 'entries'} imported${duplicates > 0 && skipDuplicates ? `, ${duplicates} already there` : ''}.`);
    close();
  };

  return (
    <Card>
      <SectionTitle>Import a statement</SectionTitle>
      <p className="t-caption">
        A CSV or OFX export from your bank. Your rules run on it as it comes in, so most of it arrives already categorised — nothing is
        added until you have seen the preview.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,.ofx,.qfx,text/csv,text/plain"
          className="sr-only"
          aria-label="Statement file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void read(file).catch(() => setError('Could not read that file.'));
          }}
        />
        <Button onClick={() => fileRef.current?.click()}>Choose a file</Button>
        {done && (
          <p role="status" className="text-xs text-positive">
            {done} Undo is available from the toast.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-critical-text">
            {error}
          </p>
        )}
      </div>

      {loaded && (
        <Modal title={`Import ${loaded.name}`} width="lg" onClose={close}>
          {/* Mapping first: everything below it is downstream of getting the
              columns right, and a wrong guess is obvious here and nowhere else. */}
          {loaded.table && (
            <ColumnMapper
              table={loaded.table}
              map={loaded.map}
              onChange={(map) => setLoaded({ ...loaded, map })}
            />
          )}

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {accounts.length > 1 && (
              <div>
                <Label htmlFor="import-account">Into account</Label>
                <Select id="import-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="import-category">Category for anything no rule claims</Label>
              <Select id="import-category" value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                <option value={UNCATEGORISED}>{UNCATEGORISED}</option>
                {categories
                  .filter((c) => c !== UNCATEGORISED)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-hairline pt-3 text-xs">
            <span className="text-ink-secondary">
              {parsed.rows.length} {parsed.rows.length === 1 ? 'line' : 'lines'} read
              {parsed.skipped > 0 && <span className="text-ink-muted"> · {parsed.skipped} without a date or amount, ignored</span>}
              {categorised > 0 && <span className="text-positive"> · {categorised} filed by your rules</span>}
            </span>
            {duplicates > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-ink-secondary">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
                Skip {duplicates} already in the ledger
              </label>
            )}
          </div>

          {preview.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-muted">
              Nothing readable with these columns. Try a different mapping above.
            </p>
          ) : (
            <div className="mt-3 max-h-[38vh] overflow-y-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">Preview of the statement lines to import</caption>
                <thead className="sticky top-0 bg-surface-1">
                  <tr>
                    {['Date', 'Description', 'Files as', 'Amount'].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`border-b border-hairline pb-2 text-xs font-medium text-ink-muted ${i === 3 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 300).map((p, i) => (
                    <tr
                      key={i}
                      className={`border-b border-hairline/60 last:border-b-0 ${p.duplicate && skipDuplicates ? 'opacity-40' : ''}`}
                    >
                      <td className="num-col py-1.5 whitespace-nowrap text-ink-muted">{formatDate(`${p.row.date}T12:00:00.000Z`)}</td>
                      <td className="max-w-0 truncate py-1.5 pl-3 text-ink-secondary">{p.row.description || '—'}</td>
                      <td className="py-1.5 pl-3 whitespace-nowrap text-ink-secondary">
                        {p.event.type === 'income' ? 'Income' : p.event.category}
                        {p.duplicate && <span className="ml-1.5 text-ink-muted">· already there</span>}
                      </td>
                      <td className={`num-col py-1.5 pl-3 text-right ${p.row.amount < 0 ? 'text-complement' : 'text-positive'}`}>
                        {p.row.amount < 0 ? '−' : '+'}
                        {formatMoney(Math.abs(p.row.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 300 && <p className="t-caption mt-2">…and {preview.length - 300} more, all of which will be imported.</p>}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button disabled={willImport.length === 0} onClick={run}>
              Import {willImport.length} {willImport.length === 1 ? 'entry' : 'entries'}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function blankMap(): ColumnMap {
  return { date: NO_COLUMN, description: NO_COLUMN, amount: NO_COLUMN, debit: NO_COLUMN, credit: NO_COLUMN };
}

/**
 * Manual override for the column guess.
 *
 * Always shown rather than only on a bad guess: the guess is a heuristic over
 * whatever the bank chose to write, and someone who cannot see what it decided
 * has no way to tell a correct import from a plausible-looking wrong one.
 */
function ColumnMapper({ table, map, onChange }: { table: ParsedTable; map: ColumnMap; onChange: (map: ColumnMap) => void }) {
  const options = table.headers.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }));
  const split = map.debit !== NO_COLUMN || map.credit !== NO_COLUMN;

  const field = (key: keyof ColumnMap, label: string, allowNone: boolean) => (
    <div>
      <Label htmlFor={`map-${key}`}>{label}</Label>
      <Select
        id={`map-${key}`}
        value={String(map[key])}
        onChange={(e) => onChange({ ...map, [key]: Number(e.target.value) })}
      >
        {allowNone && <option value={NO_COLUMN}>None</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );

  return (
    <div>
      <p className="t-label mb-2">Columns</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field('date', 'Date', false)}
        {field('description', 'Description', true)}
        {/* A statement carries the amount one way or the other, never both, so
            only the pair that applies is shown. */}
        {split ? (
          <>
            {field('debit', 'Money out', true)}
            {field('credit', 'Money in', true)}
          </>
        ) : (
          field('amount', 'Amount', true)
        )}
      </div>
      <button
        type="button"
        onClick={() =>
          split
            ? onChange({ ...map, debit: NO_COLUMN, credit: NO_COLUMN, amount: options.length - 1 })
            : onChange({ ...map, amount: NO_COLUMN, debit: options.length - 2, credit: options.length - 1 })
        }
        className="t-caption mt-2 cursor-pointer underline underline-offset-2 hover:text-ink-secondary"
      >
        {split ? 'My bank uses a single signed amount column' : 'My bank splits money in and out across two columns'}
      </button>
    </div>
  );
}
