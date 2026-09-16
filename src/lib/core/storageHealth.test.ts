// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reportWriteFailure, clearWriteFailure, getWriteFailure, onWriteFailure } from './storageHealth';

/** The shape browsers actually throw. `DOMException` carries the legacy numeric
 * code as well as the name, and different engines set different ones. */
function quotaError(name: string, code?: number): DOMException {
  const error = new DOMException('full', name);
  if (code !== undefined) Object.defineProperty(error, 'code', { value: code });
  return error;
}

describe('storageHealth', () => {
  beforeEach(() => clearWriteFailure());

  it('starts with nothing wrong', () => {
    expect(getWriteFailure()).toBeNull();
  });

  it('recognises a quota failure as being out of room', () => {
    reportWriteFailure(quotaError('QuotaExceededError', 22));
    expect(getWriteFailure()?.outOfRoom).toBe(true);
  });

  it("recognises Firefox's spelling of the same thing", () => {
    reportWriteFailure(quotaError('NS_ERROR_DOM_QUOTA_REACHED', 1014));
    expect(getWriteFailure()?.outOfRoom).toBe(true);
  });

  // A private window refusing storage outright is a different problem with a
  // different fix, so it must not be reported as "you are out of room".
  it('does not treat a blocked-storage failure as being out of room', () => {
    reportWriteFailure(quotaError('SecurityError'));
    expect(getWriteFailure()).not.toBeNull();
    expect(getWriteFailure()?.outOfRoom).toBe(false);
  });

  it('notifies subscribers on failure and again when a later write succeeds', () => {
    const seen = vi.fn();
    const stop = onWriteFailure(seen);

    reportWriteFailure(quotaError('QuotaExceededError', 22));
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ outOfRoom: true }));

    clearWriteFailure();
    expect(seen).toHaveBeenLastCalledWith(null);
    expect(getWriteFailure()).toBeNull();

    stop();
    reportWriteFailure(quotaError('QuotaExceededError', 22));
    expect(seen).toHaveBeenCalledTimes(2);
  });

  // Every successful write calls this, so it has to be free when nothing is
  // wrong rather than firing an event on each keystroke's worth of persistence.
  it('stays quiet when clearing with no failure outstanding', () => {
    const seen = vi.fn();
    const stop = onWriteFailure(seen);
    clearWriteFailure();
    expect(seen).not.toHaveBeenCalled();
    stop();
  });
});
