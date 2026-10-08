import { describe, it, expect } from 'vitest';
import { assertFileSize, FileTooLargeError, formatMegabytes, readTextFile } from './files';

const MB = 1024 * 1024;

describe('readTextFile', () => {
  it('reads a file under the limit', async () => {
    expect(await readTextFile(new Blob(['date,amount\n']), MB)).toBe('date,amount\n');
  });

  // The guard runs on `size`, before `text()`, which is what makes it worth
  // having: the failure it prevents is the read itself.
  it('refuses a file over the limit without reading it', async () => {
    const blob = new Blob(['x'.repeat(2048)]);
    let read = false;
    const spy = Object.assign(blob, { text: () => ((read = true), Promise.resolve('')) });
    await expect(readTextFile(spy, 1024)).rejects.toBeInstanceOf(FileTooLargeError);
    expect(read).toBe(false);
  });

  it('accepts a file of exactly the limit', async () => {
    await expect(readTextFile(new Blob(['x'.repeat(1024)]), 1024)).resolves.toHaveLength(1024);
  });
});

describe('assertFileSize', () => {
  it('names both sizes, so the reader can tell a wrong file from a big one', () => {
    try {
      assertFileSize(new Blob([new Uint8Array(30 * MB)]), 25 * MB, 'That file');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(FileTooLargeError);
      expect((e as Error).message).toBe('That file is 30 MB — more than the 25 MB this accepts.');
    }
  });
});

describe('formatMegabytes', () => {
  it('keeps one decimal below ten and drops it above', () => {
    expect(formatMegabytes(0.4 * MB)).toBe('0.4 MB');
    expect(formatMegabytes(9.84 * MB)).toBe('9.8 MB');
    expect(formatMegabytes(25 * MB)).toBe('25 MB');
  });
});
