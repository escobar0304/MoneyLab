import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { LedgerEvent } from '../../lib/types';
import { mergeEvents } from '../../lib/migrations';
import { formatDateTime } from '../../lib/format';
import { Button, Card, Modal, SectionTitle } from '../ui/primitives';
import { receiptsFootprint, formatBytes } from '../../lib/receipts';

/** Nag threshold. Long enough not to be noise, short enough that a browser
 * clearing site data can't cost more than a month of entries. */
const STALE_BACKUP_DAYS = 30;

function isLedgerEventArray(value: unknown): value is LedgerEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (e) =>
        e &&
        typeof e === 'object' &&
        typeof (e as Record<string, unknown>).id === 'string' &&
        typeof (e as Record<string, unknown>).type === 'string' &&
        typeof (e as Record<string, unknown>).timestamp === 'string'
    )
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function ExportImport() {
  const events = useStore((s) => s.events);
  const lastExportedAt = useStore((s) => s.lastExportedAt);
  const importEvents = useStore((s) => s.importEvents);
  const markExported = useStore((s) => s.markExported);
  const clearAll = useStore((s) => s.clearAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<LedgerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const stale = events.length > 0 && (!lastExportedAt || daysSince(lastExportedAt) >= STALE_BACKUP_DAYS);

  const [receipts, setReceipts] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    receiptsFootprint().then(setReceipts).catch(() => setReceipts(null));
  }, [events]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneylab-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
  };

  const onFileChosen = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isLedgerEventArray(parsed)) {
        setError('That file does not look like a MoneyLab export (expected an array of ledger events).');
        return;
      }
      setPending(parsed);
    } catch {
      setError('Could not parse that file as JSON.');
    }
  };

  const runImport = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    const { added, duplicates } = importEvents(pending, mode);
    setResult(
      mode === 'merge'
        ? `Merged: ${added} new ${added === 1 ? 'entry' : 'entries'} added, ${duplicates} already present.`
        : `Replaced everything with ${added} ${added === 1 ? 'entry' : 'entries'}.`
    );
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Previewed against the real ledger so the modal can state the actual outcome
  // rather than asking the user to guess what a merge will do.
  const preview = pending ? mergeEvents(events, pending) : null;

  return (
    <Card>
      <SectionTitle>Data</SectionTitle>

      {stale && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-complement/30 bg-complement/10 p-3">
          <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-complement" fill="currentColor" aria-hidden="true">
            <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.75.75 0 0 0-.75.75v2.6a.75.75 0 0 0 1.5 0v-2.6A.75.75 0 0 0 8 5.7Zm0 5.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
          </svg>
          <p className="text-sm text-ink-secondary">
            {lastExportedAt
              ? `Your last backup was ${daysSince(lastExportedAt)} days ago.`
              : "You've never exported a backup."}{' '}
            Everything lives in this browser's storage — clearing site data, or switching browser, loses all of it.
          </p>
        </div>
      )}

      <p className="mb-4 text-sm text-ink-muted">
        {events.length} {events.length === 1 ? 'event' : 'events'} stored locally.{' '}
        {lastExportedAt ? `Last backup ${formatDateTime(lastExportedAt)}.` : 'No backup taken yet.'}
        {receipts && receipts.count > 0 && (
          <>
            {' '}
            {receipts.count} receipt{receipts.count === 1 ? '' : 's'} ({formatBytes(receipts.bytes)}) are kept separately and are{' '}
            <strong>not</strong> included in the JSON export.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exportData} disabled={events.length === 0}>
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={events.length === 0}>
          Clear all data
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileChosen(file);
          }}
        />
      </div>

      {error && <p className="mt-2 text-sm text-critical-text">{error}</p>}
      {result && <p className="mt-2 text-sm text-ink-secondary">{result}</p>}

      {pending && preview && (
        <Modal title="Import data" onClose={() => setPending(null)}>
          <p className="text-sm text-ink-secondary">
            That file holds <strong>{pending.length}</strong> {pending.length === 1 ? 'event' : 'events'}.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
            <li className="rounded-lg border border-hairline p-3">
              <strong className="text-ink">Merge</strong> — adds <strong>{preview.added}</strong> new{' '}
              {preview.added === 1 ? 'entry' : 'entries'}, skips <strong>{preview.duplicates}</strong> already here. Nothing you
              have is lost.
            </li>
            <li className="rounded-lg border border-hairline p-3">
              <strong className="text-ink">Replace</strong> — discards your current <strong>{events.length}</strong>{' '}
              {events.length === 1 ? 'event' : 'events'} and keeps only the file's.
            </li>
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => runImport('replace')}>
              Replace
            </Button>
            <Button onClick={() => runImport('merge')}>Merge</Button>
          </div>
        </Modal>
      )}

      {confirmClear && (
        <Modal title="Clear all data?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-ink-secondary">
            This deletes all <strong>{events.length}</strong> ledger events — income sources, income, expenses and categories.
            You can undo it immediately afterwards, but not once you leave the page.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAll();
                setConfirmClear(false);
              }}
            >
              Delete everything
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
