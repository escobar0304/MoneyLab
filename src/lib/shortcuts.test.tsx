// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useShortcuts } from './shortcuts';

const handlers = {
  onNavigate: vi.fn(),
  onNewExpense: vi.fn(),
  onUndo: vi.fn(),
  onHelp: vi.fn(),
};

function Harness() {
  useShortcuts(handlers);
  return (
    <div>
      <input aria-label="a field" />
      <button type="button">somewhere to focus</button>
    </div>
  );
}

beforeEach(() => {
  Object.values(handlers).forEach((h) => h.mockReset());
  render(<Harness />);
});

describe('useShortcuts', () => {
  it('navigates on the g chord', async () => {
    await userEvent.keyboard('ge');
    expect(handlers.onNavigate).toHaveBeenCalledWith('entries');
  });

  it('supports every destination', async () => {
    for (const [keys, tab] of [
      ['go', 'overview'],
      ['gp', 'plan'],
      ['gi', 'irs'],
      ['gm', 'markets'],
      ['gs', 'settings'],
    ] as const) {
      handlers.onNavigate.mockReset();
      await userEvent.keyboard(keys);
      expect(handlers.onNavigate).toHaveBeenCalledWith(tab);
    }
  });

  it('does not navigate on a second key without the g', async () => {
    await userEvent.keyboard('e');
    expect(handlers.onNavigate).not.toHaveBeenCalled();
  });

  it('opens the new expense field on n', async () => {
    await userEvent.keyboard('n');
    expect(handlers.onNewExpense).toHaveBeenCalledTimes(1);
  });

  it('shows help on ?', async () => {
    await userEvent.keyboard('?');
    expect(handlers.onHelp).toHaveBeenCalledTimes(1);
  });

  it('stays out of the way while typing', async () => {
    // The single most important property: a bare letter is a character when the
    // user is in a field, not a command.
    await userEvent.click(screen.getByLabelText('a field'));
    await userEvent.keyboard('never gonna');

    expect(handlers.onNewExpense).not.toHaveBeenCalled();
    expect(handlers.onNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('a field')).toHaveValue('never gonna');
  });

  it('leaves the field its own undo rather than hijacking Ctrl+Z', async () => {
    await userEvent.click(screen.getByLabelText('a field'));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handlers.onUndo).not.toHaveBeenCalled();
  });

  it('undoes with Ctrl+Z outside a field', async () => {
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  it('ignores letters pressed with a modifier', async () => {
    await userEvent.keyboard('{Alt>}n{/Alt}');
    expect(handlers.onNewExpense).not.toHaveBeenCalled();
  });
});
