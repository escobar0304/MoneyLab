// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rescueExport } from './rescue';

const KEY = 'moneylab-v1';

let clicked: { name: string; blob: Blob } | null = null;

beforeEach(() => {
  localStorage.clear();
  clicked = null;
  let pending: Blob | null = null;
  // jsdom implements neither, and between them they are the whole mechanism.
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      pending = blob;
      return 'blob:stub';
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked = { name: this.download, blob: pending! };
  });
});

afterEach(() => vi.unstubAllGlobals());

async function downloadedText(): Promise<string> {
  return await clicked!.blob.text();
}

describe('rescueExport', () => {
  it('writes the events as a bare array, the same shape a normal export takes', async () => {
    const events = [
      { id: 'a', type: 'income', timestamp: '2026-01-01T10:00:00.000Z', amount: 10, label: 'Pay' },
      { id: 'b', type: 'expense', timestamp: '2026-01-02T10:00:00.000Z', amount: 4, category: 'Food' },
    ];
    localStorage.setItem(KEY, JSON.stringify({ state: { events }, version: 2 }));

    const result = rescueExport();

    expect(result).toEqual({ ok: true, count: 2 });
    expect(clicked!.name).toMatch(/^moneylab-rescue-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await downloadedText())).toEqual(events);
  });

  // The case the whole module exists for: if the blob cannot be parsed, the
  // bytes are still worth more off the machine than on it.
  it('hands over the raw bytes when the stored blob is unparseable', async () => {
    localStorage.setItem(KEY, '{ this is not json');

    const result = rescueExport();

    expect(result).toEqual({ ok: true, count: 0 });
    expect(clicked!.name).toContain('rescue-raw');
    expect(await downloadedText()).toBe('{ this is not json');
  });

  it('reports rather than downloads when there is nothing stored', () => {
    expect(rescueExport()).toEqual({ ok: false, reason: expect.stringContaining('No saved ledger') });
    expect(clicked).toBeNull();
  });

  it('reports when the stored shape has no events array', () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { events: 'not an array' } }));
    expect(rescueExport()).toEqual({ ok: false, reason: expect.stringContaining('not in a shape') });
    expect(clicked).toBeNull();
  });
});
