// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageWarning } from './StorageWarning';
import { reportWriteFailure, clearWriteFailure } from '../../lib/core/storageHealth';
import * as rescue from '../../lib/core/rescue';

/** The failure arrives as a window event from outside React, so the state
 * update it causes has to be flushed before anything is asserted. */
function fail(error: unknown): void {
  act(() => reportWriteFailure(error));
}

function recover(): void {
  act(() => clearWriteFailure());
}

function quotaError(): DOMException {
  const e = new DOMException('full', 'QuotaExceededError');
  Object.defineProperty(e, 'code', { value: 22 });
  return e;
}

beforeEach(() => clearWriteFailure());
afterEach(() => vi.restoreAllMocks());

describe('StorageWarning', () => {
  it('stays off the page while writes are landing', () => {
    render(<StorageWarning />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('appears when a write is refused, without needing a remount', () => {
    render(<StorageWarning />);
    fail(quotaError());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // A full origin and a browser refusing storage outright have different fixes,
  // so they must not be reported as the same thing.
  it('tells being out of room apart from storage being blocked', () => {
    const { unmount } = render(<StorageWarning />);
    fail(quotaError());
    expect(screen.getByText(/storage is full/)).toBeInTheDocument();
    unmount();

    clearWriteFailure();
    render(<StorageWarning />);
    fail(new DOMException('no', 'SecurityError'));
    expect(screen.getByText(/refused to save/)).toBeInTheDocument();
  });

  // The warning is the only thing standing between the reader and losing what
  // is still on screen, so the one action it offers has to actually fire.
  it('exports on demand and says what was saved', async () => {
    vi.spyOn(rescue, 'rescueExport').mockReturnValue({ ok: true, count: 42 });
    render(<StorageWarning />);
    fail(quotaError());

    await userEvent.click(screen.getByRole('button', { name: 'Export now' }));

    expect(rescue.rescueExport).toHaveBeenCalledOnce();
    expect(screen.getByText(/Saved 42 entries/)).toBeInTheDocument();
  });

  it('passes on the reason when the export could not run', async () => {
    vi.spyOn(rescue, 'rescueExport').mockReturnValue({ ok: false, reason: 'No saved ledger was found.' });
    render(<StorageWarning />);
    fail(quotaError());

    await userEvent.click(screen.getByRole('button', { name: 'Export now' }));
    expect(screen.getByText('No saved ledger was found.')).toBeInTheDocument();
  });

  // It clears itself on the next write that lands, which is exactly when the
  // problem is genuinely over — not on a reload, and not on a dismiss button.
  it('goes away once a later write succeeds', () => {
    render(<StorageWarning />);
    fail(quotaError());
    expect(screen.getByRole('alert')).toBeInTheDocument();

    recover();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
