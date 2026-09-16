// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstRun } from './FirstRun';
import { onNavigate, type NavigateDetail } from '../../lib/core/navigate';

/** Collects the tab-switch requests the screen makes, which is the whole
 * contract here: every route out of this page has to be a control on it. */
function recordNavigation(): { requests: NavigateDetail[]; stop: () => void } {
  const requests: NavigateDetail[] = [];
  const stop = onNavigate((detail) => requests.push(detail));
  return { requests, stop };
}

let stopListening: (() => void) | null = null;
afterEach(() => {
  stopListening?.();
  stopListening = null;
});

describe('FirstRun', () => {
  it('says what the app is for rather than that there is no data', () => {
    render(<FirstRun />);
    expect(screen.getByRole('heading', { name: /ledger is empty/i })).toBeInTheDocument();
    expect(screen.getByText(/derived from that one list/i)).toBeInTheDocument();
  });

  it('offers the three ways in', () => {
    render(<FirstRun />);
    expect(screen.getByRole('button', { name: /Set your income/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log an expense/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import a statement/ })).toBeInTheDocument();
  });

  // The bug this screen was built to fix: it used to say "head to Entries"
  // while offering no way to get there. Every step must actually navigate.
  it('sends the income step to the Log section', async () => {
    const { requests, stop } = recordNavigation();
    stopListening = stop;
    render(<FirstRun />);

    await userEvent.click(screen.getByRole('button', { name: /Set your income/ }));
    expect(requests).toEqual([{ tab: 'entries', section: 'log' }]);
  });

  it('sends the import step to Manage, where the importer lives', async () => {
    const { requests, stop } = recordNavigation();
    stopListening = stop;
    render(<FirstRun />);

    await userEvent.click(screen.getByRole('button', { name: /Import a statement/ }));
    expect(requests).toEqual([{ tab: 'entries', section: 'manage' }]);
  });

  it('offers a way back for someone who already has a backup', async () => {
    const { requests, stop } = recordNavigation();
    stopListening = stop;
    render(<FirstRun />);

    await userEvent.click(screen.getByRole('button', { name: /Restore a backup/ }));
    expect(requests).toEqual([{ tab: 'settings' }]);
  });

  // The local-only guarantee is a selling point, not a settings detail, so it
  // belongs on the first screen anyone sees.
  it('states that nothing leaves the browser', () => {
    render(<FirstRun />);
    expect(screen.getByText(/no account, no server, no bank connection/i)).toBeInTheDocument();
  });
});
