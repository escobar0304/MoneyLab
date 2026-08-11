/**
 * Backups that happen without being remembered.
 *
 * A manual export only protects the people who remember to take one, which is
 * nobody — and everything here lives in one browser's storage, so "I cleared my
 * site data" is total loss. The File System Access API lets the page keep a
 * durable handle on a folder the user picked once, and write to it afterwards
 * with no further prompts.
 *
 * These backups are written in the clear, deliberately: keeping them encrypted
 * would mean holding the passphrase in memory forever, and a backup that stops
 * the moment the tab closes is not a backup. Encryption belongs on the manual
 * export — the file that leaves the machine. The folder is on your own disk and
 * you chose it.
 */

const DB_NAME = 'moneylab-backup';
const STORE = 'handles';
const HANDLE_KEY = 'folder';

/** Directory handles are only obtainable through a user gesture, and only in
 * browsers that implement the API — Firefox and Safari currently do not. */
export function supportsFolderBackup(): boolean {
  return typeof (window as WindowWithPicker).showDirectoryPicker === 'function';
}

interface WindowWithPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
}

/** `queryPermission`/`requestPermission` are part of the File System Access
 * proposal and absent from the standard DOM typings. */
interface PermissionCapable {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/**
 * The chosen folder, or null.
 *
 * Handles survive a reload because IndexedDB structured-clones them — this is
 * the whole reason the folder only has to be picked once.
 */
export async function savedFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFolderBackup()) return null;
  try {
    return (await withStore<FileSystemDirectoryHandle | undefined>('readonly', (s) => s.get(HANDLE_KEY))) ?? null;
  } catch {
    return null;
  }
}

/** Prompts for a folder. Must be called from a user gesture. Returns null if
 * the user cancelled — which is not an error and must not be reported as one. */
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as WindowWithPicker).showDirectoryPicker;
  if (!picker) return null;
  try {
    const handle = await picker({ mode: 'readwrite', id: 'moneylab-backups' });
    await withStore('readwrite', (s) => s.put(handle, HANDLE_KEY));
    return handle;
  } catch {
    return null;
  }
}

export async function forgetFolder(): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(HANDLE_KEY));
  } catch {
    /* nothing to forget */
  }
}

/**
 * Whether the folder is still writable.
 *
 * Permission does not always survive a restart, and re-requesting it needs a
 * user gesture — so `interactive` is false on the automatic path (just report
 * that it lapsed) and true when the user clicked something.
 */
export async function ensureWritable(handle: FileSystemDirectoryHandle, interactive: boolean): Promise<boolean> {
  const capable = handle as unknown as PermissionCapable;
  const descriptor = { mode: 'readwrite' as const };
  const state = (await capable.queryPermission?.(descriptor)) ?? 'granted';
  if (state === 'granted') return true;
  if (!interactive || state === 'denied') return false;
  return ((await capable.requestPermission?.(descriptor)) ?? 'denied') === 'granted';
}

async function writeFile(handle: FileSystemDirectoryHandle, name: string, contents: string): Promise<void> {
  const file = await handle.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(contents);
  await writable.close();
}

export const LATEST_FILE = 'moneylab-latest.json';

export interface BackupResult {
  ok: boolean;
  /** Files actually written this run. */
  written: string[];
  reason?: 'no-folder' | 'no-permission' | 'failed';
}

/**
 * Writes the ledger to the backup folder.
 *
 * Two files, not one. `moneylab-latest.json` is overwritten every time, and a
 * dated snapshot is written once per day. A single always-overwritten file is
 * one bad import away from being useless: the corruption would be faithfully
 * copied over the only good copy. The dated file is the one that survives that.
 */
export async function runBackup(events: unknown, now: Date = new Date()): Promise<BackupResult> {
  const handle = await savedFolder();
  if (!handle) return { ok: false, written: [], reason: 'no-folder' };
  if (!(await ensureWritable(handle, false))) return { ok: false, written: [], reason: 'no-permission' };

  const contents = JSON.stringify(events, null, 2);
  const dated = `moneylab-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

  try {
    await writeFile(handle, LATEST_FILE, contents);
    await writeFile(handle, dated, contents);
    return { ok: true, written: [LATEST_FILE, dated] };
  } catch {
    return { ok: false, written: [], reason: 'failed' };
  }
}
