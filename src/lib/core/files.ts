/**
 * Reading a file the reader chose, with a ceiling.
 *
 * `File.text()` reads the whole thing into memory and the caller then parses
 * all of it, so the only limit used to be whatever made the tab fall over. A
 * wrong file picked by mistake — a video, a disk image, a 2 GB log — locked the
 * page up before any of the validation that comes after got a chance to say
 * "this is not a statement".
 *
 * The limits are set against what a real file can be, not against what the
 * browser can survive: a check that only fires once things are already broken
 * is not a check.
 */

const MB = 1024 * 1024;

/**
 * A backup is the ledger, and the ledger lives in `localStorage`, which caps out
 * around 5 MB. Encryption adds a third for base64. So no genuine MoneyLab backup
 * gets anywhere near this; it is five times the largest one that could exist.
 */
export const MAX_BACKUP_BYTES = 25 * MB;

/** Years of daily transactions from a bank export run to a few megabytes. */
export const MAX_STATEMENT_BYTES = 10 * MB;

/** Before decoding. A phone photo is 3–6 MB; the cap leaves room for a long scan. */
export const MAX_RECEIPT_INPUT_BYTES = 25 * MB;

/** After compression, which is what is actually stored. A downscaled photo is
 * under 1 MB; what reaches this is a PDF, and a receipt PDF that size is a
 * different document. */
export const MAX_RECEIPT_STORED_BYTES = 10 * MB;

export class FileTooLargeError extends Error {
  readonly size: number;
  readonly limit: number;
  constructor(size: number, limit: number, what = 'That file') {
    super(`${what} is ${formatMegabytes(size)} — more than the ${formatMegabytes(limit)} this accepts.`);
    this.name = 'FileTooLargeError';
    this.size = size;
    this.limit = limit;
  }
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / MB;
  // One decimal below ten, so "0.4 MB" and "9.8 MB" stay meaningful; whole
  // numbers above it, where the decimal is noise.
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Throws `FileTooLargeError` before reading a byte of an oversized file. */
export function assertFileSize(file: Blob, limit: number, what?: string): void {
  if (file.size > limit) throw new FileTooLargeError(file.size, limit, what);
}

export async function readTextFile(file: Blob, limit: number, what?: string): Promise<string> {
  assertFileSize(file, limit, what);
  return file.text();
}
