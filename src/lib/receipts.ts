/**
 * Optional receipt images, stored in IndexedDB rather than in the ledger.
 *
 * Two reasons they live apart from the events:
 *  - localStorage caps out around 5 MB and already holds the whole ledger; a
 *    couple of phone photos would blow past that and take the ledger with them.
 *  - A JSON backup should stay small enough to actually take. Images are
 *    exported separately, on request, instead of bloating every export.
 *
 * Attachments are keyed by expense id, so an expense without one costs nothing.
 */

const DB_NAME = 'moneylab-receipts';
const STORE = 'receipts';
const DB_VERSION = 1;

/** Longest edge after downscaling. Enough to read a printed receipt, small
 * enough that a dozen of them don't fill the origin's storage quota. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

export interface ReceiptRecord {
  expenseId: string;
  blob: Blob;
  type: string;
  size: number;
  addedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'expenseId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the receipt store'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Receipt store request failed'));
      })
  );
}

/**
 * Downscales and re-encodes before storing.
 *
 * A modern phone photo is 3–6 MB; the same receipt at 1600px JPEG is usually
 * under 200 KB and just as readable. Without this step the origin's storage
 * quota is reached in a few dozen receipts and writes start failing silently.
 */
export async function compressImage(file: File): Promise<Blob> {
  // PDFs and anything non-raster pass through untouched — there's nothing to
  // downscale, and re-encoding would destroy them.
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  // Keep the original if compression somehow made it bigger (already-small PNGs).
  return blob && blob.size < file.size ? blob : file;
}

export async function saveReceipt(expenseId: string, file: File): Promise<ReceiptRecord> {
  const blob = await compressImage(file);
  const record: ReceiptRecord = {
    expenseId,
    blob,
    type: blob.type || file.type,
    size: blob.size,
    addedAt: new Date().toISOString(),
  };
  await tx('readwrite', (store) => store.put(record));
  return record;
}

export function getReceipt(expenseId: string): Promise<ReceiptRecord | undefined> {
  return tx<ReceiptRecord | undefined>('readonly', (store) => store.get(expenseId));
}

export function deleteReceipt(expenseId: string): Promise<unknown> {
  return tx('readwrite', (store) => store.delete(expenseId));
}

/** Expense ids that have a receipt, for badging the history list without
 * loading every image. */
export async function listReceiptIds(): Promise<Set<string>> {
  const keys = await tx<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return new Set(keys.map(String));
}

/** Total bytes held, so Settings can report what receipts are costing. */
export async function receiptsFootprint(): Promise<{ count: number; bytes: number }> {
  const all = await tx<ReceiptRecord[]>('readonly', (store) => store.getAll());
  return { count: all.length, bytes: all.reduce((sum, r) => sum + (r.size ?? 0), 0) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
