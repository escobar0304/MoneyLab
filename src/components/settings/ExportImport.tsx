import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/core/store';
import type { LedgerEvent } from '../../lib/core/types';
import { mergeEvents } from '../../lib/core/migrations';
import { validateImport } from '../../lib/core/importValidation';
import { formatDateTime } from '../../lib/core/format';
import { Button, Card, Input, Label, Modal, SectionTitle } from '../ui/primitives';
import { receiptsFootprint, formatBytes } from '../../lib/money/receipts';
import { decryptJSON, encryptJSON, encryptionAvailable, isEncryptedEnvelope, passphraseAdvice, WrongPassphraseError } from '../../lib/investments/crypto';

/** Nag threshold. Long enough not to be noise, short enough that a browser
 * clearing site data can't cost more than a month of entries. */
const STALE_BACKUP_DAYS = 30;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function download(contents: string, name: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportImport() {
  const events = useStore((s) => s.events);
  const lastExportedAt = useStore((s) => s.lastExportedAt);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const importEvents = useStore((s) => s.importEvents);
  const markExported = useStore((s) => s.markExported);
  const clearAll = useStore((s) => s.clearAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<LedgerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Encryption flows. `locked` holds a file that parsed as an envelope and is
  // waiting for its passphrase.
  const [encrypting, setEncrypting] = useState(false);
  const [locked, setLocked] = useState<unknown | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const canEncrypt = encryptionAvailable();
  // The nag counts either kind of backup — an automatic folder write protects
  // the data just as well as a manual download, and nagging through it would
  // train the user to ignore the warning.
  const lastAny = [lastExportedAt, lastBackupAt].filter(Boolean).sort().pop() ?? null;
  const stale = events.length > 0 && (!lastAny || daysSince(lastAny) >= STALE_BACKUP_DAYS);

  const [receipts, setReceipts] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => {
    receiptsFootprint().then(setReceipts).catch(() => setReceipts(null));
  }, [events]);

  const stamp = new Date().toISOString().slice(0, 10);

  const exportPlain = () => {
    download(JSON.stringify(events, null, 2), `moneylab-export-${stamp}.json`);
    markExported();
  };

  const exportEncrypted = async () => {
    setBusy(true);
    setError(null);
    try {
      const envelope = await encryptJSON(events, passphrase);
      download(JSON.stringify(envelope, null, 2), `moneylab-export-${stamp}.encrypted.json`);
      markExported();
      setEncrypting(false);
      setPassphrase('');
      setResult('Encrypted backup saved. Without that passphrase the file cannot be recovered — not even here.');
    } catch {
      setError('Encryption failed in this browser.');
    } finally {
      setBusy(false);
    }
  };

  const accept = (parsed: unknown) => {
    const check = validateImport(parsed);
    if (!check.ok) {
      // The specific reason, not a generic refusal: a file that fails this is
      // usually the wrong file, and naming what was wrong with it is the
      // difference between fixing it and giving up.
      setError(check.reason);
      return;
    }
    setPending(check.events);
  };

  const onFileChosen = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (isEncryptedEnvelope(parsed)) {
        setLocked(parsed);
        return;
      }
      accept(parsed);
    } catch {
      setError('Could not parse that file as JSON.');
    }
  };

  const unlock = async () => {
    if (!locked) return;
    setBusy(true);
    setError(null);
    try {
      const decrypted = await decryptJSON(locked as Parameters<typeof decryptJSON>[0], passphrase);
      setLocked(null);
      setPassphrase('');
      accept(decrypted);
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? e.message : 'Could not decrypt that file.');
    } finally {
      setBusy(false);
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

  const closeEncrypt = () => {
    setEncrypting(false);
    setPassphrase('');
    setError(null);
  };

  const closeUnlock = () => {
    setLocked(null);
    setPassphrase('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Previewed against the real ledger so the modal can state the actual outcome
  // rather than asking the user to guess what a merge will do.
  const preview = pending ? mergeEvents(events, pending) : null;
  const advice = passphraseAdvice(passphrase);

  return (
    <Card>
      <SectionTitle>Data</SectionTitle>

      {stale && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-complement/30 bg-complement/10 p-3">
          <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-complement" fill="currentColor" aria-hidden="true">
            <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.75.75 0 0 0-.75.75v2.6a.75.75 0 0 0 1.5 0v-2.6A.75.75 0 0 0 8 5.7Zm0 5.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
          </svg>
          <p className="text-sm text-ink-secondary">
            {lastAny ? `Your last backup was ${daysSince(lastAny)} days ago.` : "You've never backed anything up."} Everything lives
            in this browser's storage — clearing site data, or switching browser, loses all of it.
          </p>
        </div>
      )}

      <p className="mb-4 text-sm text-ink-muted">
        {events.length} {events.length === 1 ? 'event' : 'events'} stored locally.{' '}
        {lastExportedAt ? `Last export ${formatDateTime(lastExportedAt)}.` : 'No export taken yet.'}
        {receipts && receipts.count > 0 && (
          <>
            {' '}
            {receipts.count} receipt{receipts.count === 1 ? '' : 's'} ({formatBytes(receipts.bytes)}) are kept separately and are{' '}
            <strong>not</strong> included in the JSON export.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exportPlain} disabled={events.length === 0}>
          Export JSON
        </Button>
        <Button variant="secondary" onClick={() => setEncrypting(true)} disabled={events.length === 0 || !canEncrypt}>
          Export encrypted
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Import
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

      {!canEncrypt && (
        // Not a bug worth hiding: WebCrypto is simply absent outside a secure
        // context, which happens when this container is reached over plain HTTP
        // from another machine.
        <p className="mt-2 text-xs text-ink-muted">
          Encrypted export needs a secure context (HTTPS, or localhost). Reached over plain HTTP from another machine, the
          browser does not expose the crypto API at all.
        </p>
      )}

      {error && !encrypting && !locked && <p className="mt-2 text-sm text-critical-text">{error}</p>}
      {result && <p className="mt-2 text-sm text-ink-secondary">{result}</p>}

      {encrypting && (
        <Modal title="Encrypt this backup" onClose={closeEncrypt}>
          <p className="text-sm text-ink-secondary">
            The file will be encrypted with AES-GCM using a key derived from your passphrase. It is safe to keep in cloud
            storage afterwards.
          </p>
          <div className="mt-3">
            <Label htmlFor="export-pass">Passphrase</Label>
            <Input
              id="export-pass"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && advice.ok && exportEncrypted()}
              autoFocus
              autoComplete="new-password"
            />
            <p className={`mt-1 text-xs ${advice.ok ? 'text-ink-muted' : 'text-critical-text'}`}>{advice.message}</p>
          </div>
          {/* Stated before the file exists, not after. There is no recovery
              path, and that is a property of doing the encryption properly. */}
          <p className="mt-3 rounded-lg border border-complement/30 bg-complement/10 p-2.5 text-xs text-ink-secondary">
            Write it down somewhere. Nothing in this app can open the file without it.
          </p>
          {error && <p className="mt-2 text-sm text-critical-text">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeEncrypt}>
              Cancel
            </Button>
            <Button onClick={exportEncrypted} disabled={!advice.ok || busy}>
              {busy ? 'Encrypting…' : 'Encrypt and download'}
            </Button>
          </div>
        </Modal>
      )}

      {locked !== null && (
        <Modal title="This backup is encrypted" onClose={closeUnlock}>
          <p className="text-sm text-ink-secondary">Enter the passphrase it was saved with.</p>
          <div className="mt-3">
            <Label htmlFor="import-pass">Passphrase</Label>
            <Input
              id="import-pass"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          {error && <p className="mt-2 text-sm text-critical-text">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeUnlock}>
              Cancel
            </Button>
            <Button onClick={unlock} disabled={passphrase.length === 0 || busy}>
              {busy ? 'Decrypting…' : 'Unlock'}
            </Button>
          </div>
        </Modal>
      )}

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
