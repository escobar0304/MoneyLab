import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { runBackup, savedFolder, supportsFolderBackup, type BackupResult } from './backup';

/** Quiet period after the last change before writing. Long enough that typing an
 * amount digit by digit is one backup rather than five, short enough that
 * closing the tab straight after logging something still catches it. */
const SETTLE_MS = 4000;

export interface AutoBackupState {
  /** Null while still checking, then whether a folder is configured. */
  configured: boolean | null;
  supported: boolean;
  lastResult: BackupResult | null;
  /** True between a change landing and the write completing. */
  pending: boolean;
}

/**
 * Writes the ledger to the chosen folder shortly after it changes.
 *
 * Debounced rather than immediate, and skipped entirely on the first render:
 * without that, simply opening the app would rewrite both backup files before
 * the user had done anything, which makes the timestamps meaningless.
 */
export function useAutoBackup(): AutoBackupState {
  const events = useStore((s) => s.events);
  const markBackedUp = useStore((s) => s.markBackedUp);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastResult, setLastResult] = useState<BackupResult | null>(null);
  const [pending, setPending] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    let live = true;
    savedFolder().then((handle) => live && setConfigured(handle !== null));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!configured) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    setPending(true);
    const timer = setTimeout(async () => {
      const result = await runBackup(events);
      setLastResult(result);
      setPending(false);
      if (result.ok) markBackedUp();
      // A lapsed permission is not a transient failure — the folder needs
      // re-granting through a click, so stop claiming it is configured.
      if (result.reason === 'no-folder') setConfigured(false);
    }, SETTLE_MS);

    return () => clearTimeout(timer);
  }, [events, configured, markBackedUp]);

  return { configured, supported: supportsFolderBackup(), lastResult, pending };
}
