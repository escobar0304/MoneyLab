// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../core/store';
import { isDemoEvent } from './sampleLedger';
import type { LedgerEvent } from '../core/types';

/** An entry as the app itself would write one — a real UUID, no prefix. */
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

beforeEach(() => {
  useStore.setState({ events: [], undoSnapshot: null });
});

describe('loadDemo', () => {
  it('fills an empty ledger', () => {
    expect(useStore.getState().loadDemo()).toBe(true);
    const events = useStore.getState().events;
    expect(events.length).toBeGreaterThan(50);
    expect(events.every(isDemoEvent)).toBe(true);
  });

  // The guard that matters. The button is only drawn on the first-run screen,
  // but a guard that depends on a button not being on screen is not a guard —
  // and what is on the other side of it is somebody's real financial record.
  it('refuses to touch a ledger that has anything real in it', () => {
    const mine = [realExpense('Lidl'), realExpense('Pingo Doce')];
    useStore.setState({ events: mine });

    expect(useStore.getState().loadDemo()).toBe(false);
    expect(useStore.getState().events).toEqual(mine);
  });

  it('refuses even when the real entry is buried among demo ones', () => {
    useStore.getState().loadDemo();
    const withReal = [...useStore.getState().events, realExpense('Lidl')];
    useStore.setState({ events: withReal });

    expect(useStore.getState().loadDemo()).toBe(false);
    expect(useStore.getState().events).toHaveLength(withReal.length);
  });

  it('is undoable, like everything else that rewrites the ledger', () => {
    useStore.getState().loadDemo();
    expect(useStore.getState().undoSnapshot?.label).toBe('Sample data loaded');

    useStore.getState().undo();
    expect(useStore.getState().events).toEqual([]);
  });
});

describe('clearDemo', () => {
  it('empties a ledger that is nothing but demo data', () => {
    useStore.getState().loadDemo();
    useStore.getState().clearDemo();
    expect(useStore.getState().events).toEqual([]);
  });

  // The whole reason demo data is marked by its id rather than by a flag: a
  // reader who tried the demo and then started logging for real must not lose
  // their own entries to the clean-up.
  it('keeps real entries logged on top of the demo', () => {
    useStore.getState().loadDemo();
    const mine = [realExpense('Lidl'), realExpense('Coffee')];
    useStore.setState({ events: [...useStore.getState().events, ...mine] });

    useStore.getState().clearDemo();

    expect(useStore.getState().events).toEqual(mine);
  });

  it('does nothing, and takes no snapshot, when there is no demo data', () => {
    const mine = [realExpense('Lidl')];
    useStore.setState({ events: mine, undoSnapshot: null });

    useStore.getState().clearDemo();

    expect(useStore.getState().events).toEqual(mine);
    // No snapshot means the undo bar does not offer to reverse a no-op.
    expect(useStore.getState().undoSnapshot).toBeNull();
  });

  it('is undoable', () => {
    useStore.getState().loadDemo();
    const loaded = useStore.getState().events;

    useStore.getState().clearDemo();
    useStore.getState().undo();

    expect(useStore.getState().events).toEqual(loaded);
  });
});
