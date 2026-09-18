// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackupFolder } from './BackupFolder';

/**
 * Both causes look identical from inside the component — `showDirectoryPicker`
 * is simply absent — so the only thing separating them is `isSecureContext`.
 * These pin that the right one is named, because the advice differs completely:
 * one is fixed by changing browser, the other by changing how you got here.
 */
function setContext({ secure, picker }: { secure: boolean; picker: boolean }) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
  if (picker) {
    (window as unknown as Record<string, unknown>).showDirectoryPicker = () => Promise.resolve({});
  } else {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
});

describe('BackupFolder when the folder API is unavailable', () => {
  // The bug this replaced: a Chrome user reaching a local container over plain
  // HTTP was told to "open MoneyLab in a Chromium browser" — while in one.
  it('blames the connection, not the browser, outside a secure context', () => {
    setContext({ secure: false, picker: false });
    render(<BackupFolder />);

    expect(screen.getByText(/needs a secure context/i)).toBeInTheDocument();
    expect(screen.getByText(/whichever browser it is/i)).toBeInTheDocument();
    expect(screen.queryByText(/open MoneyLab in a Chromium browser/i)).not.toBeInTheDocument();
  });

  it('blames the browser when the context is secure and the API still is not there', () => {
    setContext({ secure: true, picker: false });
    render(<BackupFolder />);

    expect(screen.getByText(/currently the case in Firefox and Safari/i)).toBeInTheDocument();
    expect(screen.queryByText(/needs a secure context/i)).not.toBeInTheDocument();
  });
});
