// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isStaleChunkError, recoverFromStaleChunk } from './staleChunk';

describe('isStaleChunkError', () => {
  // The wording differs per engine and there is no error code to key on, so
  // these strings are the whole detection. If a browser changes its message
  // the fix is here, and the symptom is the old error screen coming back.
  it.each([
    'Failed to fetch dynamically imported module: https://app.test/assets/PlanView-Dw4EaKLg.js',
    'error loading dynamically imported module: https://app.test/assets/PlanView-Dw4EaKLg.js',
    'Importing a module script failed.',
  ])('recognises %j', (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it('leaves a real crash alone', () => {
    expect(isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'amount')"))).toBe(false);
    expect(isStaleChunkError(new Error('Something else entirely'))).toBe(false);
  });

  it('does not throw on whatever it is handed', () => {
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError('failed to fetch dynamically imported module')).toBe(true);
  });
});

describe('recoverFromStaleChunk', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('reloads onto the version that is already installed', () => {
    expect(recoverFromStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // The guard that matters. A deploy missing a chunk from the *new* build would
  // otherwise reload forever, which is a far worse failure than the error
  // screen it is trying to avoid.
  it('refuses to reload twice in a row', () => {
    expect(recoverFromStaleChunk()).toBe(true);
    expect(recoverFromStaleChunk()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // But the lock-out is a window, not a flag set once: the next deploy has to
  // be able to recover on its own too.
  it('allows another recovery once the window has passed', () => {
    recoverFromStaleChunk();
    sessionStorage.setItem('moneylab:chunk-reload-at', String(Date.now() - 60_000));

    expect(recoverFromStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  // Private browsing refuses session storage outright. With nowhere to record
  // the attempt there is no way to detect a loop, so not starting one is the
  // only safe answer.
  it('does not reload when it cannot tell whether it already did', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(recoverFromStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
