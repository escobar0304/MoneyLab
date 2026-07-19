import { useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import type { LedgerEvent } from '../../lib/types';
import { Button, Card, Modal, SectionTitle } from '../ui/primitives';

function isLedgerEventArray(value: unknown): value is LedgerEvent[] {
  return (
    Array.isArray(value) &&
    value.every((e) => e && typeof e === 'object' && typeof (e as Record<string, unknown>).id === 'string' && typeof (e as Record<string, unknown>).type === 'string' && typeof (e as Record<string, unknown>).timestamp === 'string')
  );
}

export function ExportImport() {
  const events = useStore((s) => s.events);
  const importEvents = useStore((s) => s.importEvents);
  const clearAll = useStore((s) => s.clearAll);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<LedgerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneylab-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChosen = async (file: File) => {
    setError(null);
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

  const confirmImport = () => {
    if (pending) importEvents(pending);
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <SectionTitle>Data</SectionTitle>
      <p className="mb-4 text-sm text-neutral-500">
        Everything lives in this browser's local storage. Export a backup regularly, or move your data to another device.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exportData}>Export JSON</Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
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
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {pending && (
        <Modal title="Replace all data?" onClose={() => setPending(null)}>
          <p className="text-sm text-neutral-600">
            This file contains <strong>{pending.length}</strong> ledger events. Importing will replace your current{' '}
            <strong>{events.length}</strong> events entirely. This can't be undone unless you have another backup.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmImport}>
              Replace data
            </Button>
          </div>
        </Modal>
      )}

      {confirmClear && (
        <Modal title="Clear all data?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-neutral-600">
            This permanently deletes all <strong>{events.length}</strong> ledger events — buckets, income, expenses, subscriptions, and net worth
            history. Export a backup first if you're not sure.
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
