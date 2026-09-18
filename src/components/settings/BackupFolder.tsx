import { useState } from 'react';
import { useStore } from '../../lib/core/store';
import { chooseFolder, forgetFolder, runBackup, ensureWritable, savedFolder, LATEST_FILE } from '../../lib/settings/backup';
import { useAutoBackup } from '../../lib/settings/useAutoBackup';
import { formatDateTime } from '../../lib/core/format';
import { Button, Card, SectionTitle, Badge } from '../ui/primitives';

/**
 * Backups that keep happening after the user stops thinking about them.
 *
 * The folder is chosen once through the system picker; the handle survives
 * reloads in IndexedDB, so every later write needs no prompt. This is the only
 * protection in the app against the failure that actually loses everything —
 * clearing site data — because it puts a copy outside the browser entirely.
 */
export function BackupFolder() {
  const events = useStore((s) => s.events);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const markBackedUp = useStore((s) => s.markBackedUp);
  const { configured, supported, lastResult, pending } = useAutoBackup();

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState<boolean | null>(null);

  const active = linked ?? configured;

  const pick = async () => {
    setBusy(true);
    setStatus(null);
    const handle = await chooseFolder();
    if (!handle) {
      setBusy(false);
      return; // cancelled — not an error
    }
    const result = await runBackup(events);
    setLinked(true);
    if (result.ok) markBackedUp();
    setStatus(result.ok ? `Backed up to ${result.written.join(' and ')}.` : 'Folder linked, but the first write failed.');
    setBusy(false);
  };

  const now = async () => {
    setBusy(true);
    setStatus(null);
    const handle = await savedFolder();
    // Permission can lapse between sessions and only a click can restore it,
    // which is exactly what this is.
    if (handle && !(await ensureWritable(handle, true))) {
      setStatus('Permission to write there was refused.');
      setBusy(false);
      return;
    }
    const result = await runBackup(events);
    if (result.ok) markBackedUp();
    setStatus(result.ok ? `Backed up to ${result.written.join(' and ')}.` : 'Could not write to that folder.');
    setBusy(false);
  };

  const unlink = async () => {
    await forgetFolder();
    setLinked(false);
    setStatus('Folder forgotten. The files already written are untouched.');
  };

  if (!supported) {
    // Two different causes, two different fixes, and telling them apart matters:
    // outside a secure context the API is withheld from *every* browser, so the
    // old copy sent a Chrome user reached over plain HTTP off to "open MoneyLab
    // in a Chromium browser" while they were already in one.
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    return (
      <Card>
        <SectionTitle>Automatic backup</SectionTitle>
        <p className="text-sm text-ink-muted">
          {insecure ? (
            <>
              This needs a secure context, and this page was not loaded over one — reached over plain HTTP from another
              machine, the browser withholds the File System Access API whichever browser it is. Over HTTPS (or on{' '}
              <code className="text-ink-secondary">localhost</code>) it becomes available. Use{' '}
              <strong className="text-ink-secondary">Export</strong> above in the meantime.
            </>
          ) : (
            <>
              This browser cannot hold a durable handle on a folder — the File System Access API is missing, which is
              currently the case in Firefox and Safari. Use <strong className="text-ink-secondary">Export</strong> above, or
              open MoneyLab in a Chromium browser to set this up.
            </>
          )}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        action={
          active ? (
            <Badge tone={lastResult && !lastResult.ok ? 'bad' : 'good'}>
              {pending ? 'Saving…' : lastResult && !lastResult.ok ? 'Needs attention' : 'On'}
            </Badge>
          ) : undefined
        }
      >
        Automatic backup
      </SectionTitle>

      {active ? (
        <>
          <p className="text-sm text-ink-secondary">
            Every change is written to your chosen folder a few seconds later. Two files:{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">{LATEST_FILE}</code>, always current, and one dated file
            per day — so a bad import can be rolled back to yesterday rather than faithfully copied over the only good copy.
          </p>
          <p className="mt-1.5 text-xs text-ink-muted">
            {lastBackupAt ? `Last written ${formatDateTime(lastBackupAt)}.` : 'Nothing written yet.'}
          </p>
          {lastResult && !lastResult.ok && lastResult.reason === 'no-permission' && (
            <p className="mt-2 text-sm text-critical-text">
              Write permission has lapsed — browsers drop it between sessions. Use “Back up now” to restore it.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={now} disabled={busy || events.length === 0}>
              Back up now
            </Button>
            <Button variant="secondary" onClick={pick} disabled={busy}>
              Change folder
            </Button>
            <Button variant="ghost" onClick={unlink} disabled={busy}>
              Stop
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">
            Pick a folder once and MoneyLab writes a copy of the ledger there whenever it changes — no prompts afterwards, and
            no reliance on you remembering to export.
          </p>
          {/* Said plainly rather than buried: this is a real property of the
              feature and the reason the encrypted export still exists. */}
          <p className="mt-1.5 text-xs text-ink-muted">
            These files are written unencrypted. Keeping them encrypted would mean holding your passphrase in memory forever,
            and a backup that stops when the tab closes is not a backup. For a copy that leaves this machine, use{' '}
            <strong className="text-ink-secondary">Export encrypted</strong> above.
          </p>
          <div className="mt-3">
            <Button onClick={pick} disabled={busy}>
              Choose a folder
            </Button>
          </div>
        </>
      )}

      {status && <p className="mt-2 text-sm text-ink-secondary">{status}</p>}
    </Card>
  );
}
