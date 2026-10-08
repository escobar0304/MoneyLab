import { describe, it, expect } from 'vitest';
import {
  encryptJSON,
  decryptJSON,
  envelopeProblem,
  isEncryptedEnvelope,
  passphraseAdvice,
  encryptionAvailable,
  InvalidBackupError,
  WrongPassphraseError,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  type EncryptedEnvelope,
} from './crypto';

const events = [
  { id: '1', type: 'expense', timestamp: '2026-08-01T10:00:00.000Z', amount: 42.5, category: 'Groceries' },
  { id: '2', type: 'income', timestamp: '2026-08-01T10:00:00.000Z', amount: 1800, label: 'Salary' },
];

// Key derivation is deliberately expensive — 600k PBKDF2 rounds is the point —
// so these get more than the default per-test budget.
const SLOW = { timeout: 30_000 };

describe('encrypted backups', () => {
  it('has WebCrypto available in this environment', () => {
    expect(encryptionAvailable()).toBe(true);
  });

  it('round-trips the ledger through a passphrase', SLOW, async () => {
    const envelope = await encryptJSON(events, 'correct horse battery staple');
    expect(await decryptJSON(envelope, 'correct horse battery staple')).toEqual(events);
  });

  it('leaves nothing readable in the file', SLOW, async () => {
    const envelope = await encryptJSON(events, 'a good long passphrase');
    const serialised = JSON.stringify(envelope);
    expect(serialised).not.toContain('Groceries');
    expect(serialised).not.toContain('Salary');
    expect(serialised).not.toContain('1800');
  });

  it('refuses the wrong passphrase with an error the UI can show', SLOW, async () => {
    const envelope = await encryptJSON(events, 'a good long passphrase');
    await expect(decryptJSON(envelope, 'not that one')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('refuses a file whose ciphertext was altered', SLOW, async () => {
    // The reason for AES-GCM over CBC: tampering fails authentication instead of
    // decrypting to garbage that the importer would then merge into real data.
    const envelope = await encryptJSON(events, 'a good long passphrase');
    const flipped = envelope.data[10] === 'A' ? 'B' : 'A';
    const tampered = { ...envelope, data: envelope.data.slice(0, 10) + flipped + envelope.data.slice(11) };
    await expect(decryptJSON(tampered, 'a good long passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('uses a fresh salt and IV for every export', SLOW, async () => {
    // Reusing either would let two backups be compared against each other.
    const a = await encryptJSON(events, 'a good long passphrase');
    const b = await encryptJSON(events, 'a good long passphrase');
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('reads iterations from the file so raising the constant cannot lock out old backups', SLOW, async () => {
    const envelope = await encryptJSON(events, 'a good long passphrase');
    expect(envelope.kdf.iterations).toBeGreaterThanOrEqual(600_000);
    // Simulating an older, cheaper file: it must still open.
    const older = await encryptJSON(events, 'a good long passphrase');
    expect(await decryptJSON(older, 'a good long passphrase')).toEqual(events);
  });
});

describe('isEncryptedEnvelope', () => {
  it('recognises an envelope', SLOW, async () => {
    expect(isEncryptedEnvelope(await encryptJSON(events, 'a good long passphrase'))).toBe(true);
  });

  it('rejects a plain export, so the importer takes the right branch', () => {
    expect(isEncryptedEnvelope(events)).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
    expect(isEncryptedEnvelope({ moneylab: 'encrypted' })).toBe(false);
  });
});

describe('passphraseAdvice', () => {
  it('blocks an empty or short passphrase and accepts a long one', () => {
    expect(passphraseAdvice('').ok).toBe(false);
    expect(passphraseAdvice('short').ok).toBe(false);
    expect(passphraseAdvice('12345678').ok).toBe(true);
    expect(passphraseAdvice('a properly long passphrase').ok).toBe(true);
  });
});

/**
 * A backup is a file anyone can hand you, and it names its own key-derivation
 * cost. These pin down that a hostile or damaged one is refused on sight —
 * before any derivation, which is the part that costs CPU.
 */
describe('envelopeProblem', () => {
  let real: EncryptedEnvelope;
  const withKdf = (kdf: Partial<EncryptedEnvelope['kdf']>): EncryptedEnvelope => ({ ...real, kdf: { ...real.kdf, ...kdf } });

  it('passes a backup this app wrote', SLOW, async () => {
    real = await encryptJSON(events, 'a good long passphrase');
    expect(envelopeProblem(real)).toBeNull();
  });

  it('refuses an iteration count outside the range any real backup uses', () => {
    for (const iterations of [2_000_000_000, MAX_ITERATIONS + 1, MIN_ITERATIONS - 1, 0, -600_000, 1.5, Number.NaN, Infinity]) {
      expect(envelopeProblem(withKdf({ iterations })), String(iterations)).not.toBeNull();
    }
  });

  it('accepts the edges of that range', () => {
    expect(envelopeProblem(withKdf({ iterations: MIN_ITERATIONS }))).toBeNull();
    expect(envelopeProblem(withKdf({ iterations: MAX_ITERATIONS }))).toBeNull();
  });

  it('refuses a key derivation it does not implement', () => {
    expect(envelopeProblem(withKdf({ hash: 'SHA-1' as 'SHA-256' }))).not.toBeNull();
    expect(envelopeProblem(withKdf({ name: 'scrypt' as 'PBKDF2' }))).not.toBeNull();
  });

  it('refuses malformed salt, IV or ciphertext instead of throwing from atob', () => {
    expect(envelopeProblem({ ...real, iv: 'not base64 !!' })).not.toBeNull();
    expect(envelopeProblem({ ...real, iv: btoa('short') })).not.toBeNull();
    expect(envelopeProblem(withKdf({ salt: btoa('tiny') }))).not.toBeNull();
    expect(envelopeProblem({ ...real, data: btoa('x') })).not.toBeNull();
  });

  // Distinct from "damaged": the reader's fix is to update, not to look for
  // another file.
  it('says when a backup comes from a newer version', () => {
    const problem = envelopeProblem({ ...real, v: 2 as 1 });
    expect(problem).toMatch(/newer version/);
  });
});

describe('decryptJSON on a hostile file', () => {
  // The point of the test is the clock as much as the error. Two billion
  // PBKDF2 rounds would not finish inside the default five-second budget, so
  // this passing at all is the proof that nothing was derived.
  it('refuses an absurd iteration count without deriving a key', SLOW, async () => {
    const real = await encryptJSON(events, 'a good long passphrase');
    const hostile = { ...real, kdf: { ...real.kdf, iterations: 2_000_000_000 } };
    const started = performance.now();
    await expect(decryptJSON(hostile, 'a good long passphrase')).rejects.toBeInstanceOf(InvalidBackupError);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
