/**
 * Passphrase-encrypted backups.
 *
 * A plain JSON export is every euro you have ever earned or spent, sitting in
 * the Downloads folder, readable by anything on the machine and by whatever
 * cloud folder it gets dragged into. AES-GCM with a key stretched from a
 * passphrase makes that file safe to store anywhere, and WebCrypto ships in the
 * browser, so this costs no dependency.
 *
 * AES-GCM rather than AES-CBC because it authenticates as well as encrypts: a
 * tampered or truncated backup fails to decrypt instead of quietly yielding
 * corrupted events that the importer would then merge into a real ledger.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. Roughly half a second in a
 * browser — unnoticeable once per backup, and the thing standing between a
 * stolen file and an offline dictionary attack. */
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size AES-GCM is specified for

export interface EncryptedEnvelope {
  moneylab: 'encrypted';
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: 'AES-GCM';
  iv: string;
  data: string;
}

/** Thrown for the one failure the user can act on, so the UI can say "wrong
 * passphrase" instead of surfacing a bare OperationError. */
export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase, or the file has been altered.');
    this.name = 'WrongPassphraseError';
  }
}

/**
 * WebCrypto's subtle API is only exposed in a secure context. Served over plain
 * HTTP from a LAN address — a real way to run this container — `crypto.subtle`
 * is simply undefined, so the UI has to know to offer the plain export instead
 * of failing at the moment the user clicks.
 */
export function encryptionAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.importKey === 'function';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunked: String.fromCharCode(...bytes) blows the argument limit somewhere
  // around a hundred thousand entries, which a real ledger reaches.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(value: unknown, passphrase: string): Promise<EncryptedEnvelope> {
  if (!encryptionAvailable()) throw new Error('Encryption is unavailable in this context.');
  // A fresh salt and IV per export. Reusing either across files would let two
  // backups be compared against each other.
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext);

  return {
    moneylab: 'encrypted',
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toBase64(salt) },
    cipher: 'AES-GCM',
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJSON(envelope: EncryptedEnvelope, passphrase: string): Promise<unknown> {
  if (!encryptionAvailable()) throw new Error('Decryption is unavailable in this context.');
  // Iterations come from the file, not from the constant above: raising the
  // constant later must not lock the user out of backups taken today.
  const key = await deriveKey(passphrase, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    // GCM cannot tell a wrong key from a tampered file: both fail the same
    // authentication check. Saying so is more honest than guessing which.
    throw new WrongPassphraseError();
  }
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.moneylab === 'encrypted' &&
    v.cipher === 'AES-GCM' &&
    typeof v.iv === 'string' &&
    typeof v.data === 'string' &&
    typeof v.kdf === 'object' &&
    v.kdf !== null &&
    typeof (v.kdf as Record<string, unknown>).salt === 'string' &&
    typeof (v.kdf as Record<string, unknown>).iterations === 'number'
  );
}

/** Rough guidance, not a gate. Length dominates everything else against an
 * offline attack, so that is what this actually measures. */
export function passphraseAdvice(passphrase: string): { ok: boolean; message: string } {
  if (passphrase.length === 0) return { ok: false, message: 'Enter a passphrase.' };
  if (passphrase.length < 8) return { ok: false, message: 'Too short — use at least 8 characters.' };
  if (passphrase.length < 14) return { ok: true, message: 'Usable. A few more words would be much harder to crack.' };
  return { ok: true, message: 'Good length.' };
}
