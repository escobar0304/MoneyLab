// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoBanner } from './DemoBanner';
import { useStore } from '../../lib/core/store';
import type { LedgerEvent } from '../../lib/core/types';

function realExpense(note: string): LedgerEvent {
  return {
    id: crypto.randomUUID(),
    type: 'expense',
    timestamp: '2026-05-04T10:00:00.000Z',
    amount: 12.5,
    category: 'Groceries',
    note,
  };
}

afterEach(() => {
  useStore.setState({ events: [], undoSnapshot: null });
});

describe('DemoBanner', () => {
  it('stays out of the way of a real ledger', () => {
    useStore.setState({ events: [realExpense('Lidl')] });
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says so while sample data is loaded', () => {
    useStore.getState().loadDemo();
    render(<DemoBanner />);
    expect(screen.getByText(/looking at sample data/i)).toBeInTheDocument();
  });

  // Not dismissible on purpose: the statement stays true until the data is
  // gone, and the risk it guards against is mistaking invented figures for
  // one's own finances.
  it('offers no way to dismiss it short of clearing the data', () => {
    useStore.getState().loadDemo();
    render(<DemoBanner />);

    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Clear sample data']);
  });

  it('asks before clearing, and goes away once it has', async () => {
    useStore.getState().loadDemo();
    render(<DemoBanner />);

    await userEvent.click(screen.getByRole('button', { name: /Clear sample data/ }));
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Clear it/ }));
    expect(useStore.getState().events).toEqual([]);
    expect(screen.queryByText(/looking at sample data/i)).not.toBeInTheDocument();
  });

  it('leaves everything alone when the confirmation is declined', async () => {
    useStore.getState().loadDemo();
    const loaded = useStore.getState().events;
    render(<DemoBanner />);

    await userEvent.click(screen.getByRole('button', { name: /Clear sample data/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(useStore.getState().events).toEqual(loaded);
    expect(screen.getByRole('button', { name: /Clear sample data/ })).toBeInTheDocument();
  });

  // The promise the banner itself makes — "anything you log yourself is kept".
  it('keeps entries logged on top of the demo', async () => {
    useStore.getState().loadDemo();
    const mine = realExpense('Coffee');
    useStore.setState({ events: [...useStore.getState().events, mine] });
    render(<DemoBanner />);

    await userEvent.click(screen.getByRole('button', { name: /Clear sample data/ }));
    await userEvent.click(screen.getByRole('button', { name: /Clear it/ }));

    expect(useStore.getState().events).toEqual([mine]);
  });
});
