// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setShownMonth, getShownMonth, requestMonth, onMonthRequest, resetShownMonth } from './historyView';

beforeEach(resetShownMonth);

describe('the month the history is showing', () => {
  // The form reads this to decide whether what it just posted landed somewhere
  // the reader can actually see. Before the history mounts there is no answer,
  // and "no answer" must not read as "the current month".
  it('is null until the history publishes one', () => {
    expect(getShownMonth()).toBeNull();
  });

  it('is whatever the history last published', () => {
    setShownMonth('2026-09');
    expect(getShownMonth()).toBe('2026-09');

    setShownMonth('2026-07');
    expect(getShownMonth()).toBe('2026-07');
  });
});

describe('asking the history to move', () => {
  it('reaches a listener', () => {
    const seen: string[] = [];
    const stop = onMonthRequest((m) => seen.push(m));

    requestMonth('2026-07');
    expect(seen).toEqual(['2026-07']);

    stop();
  });

  it('stops reaching it once unsubscribed', () => {
    const handler = vi.fn();
    const stop = onMonthRequest(handler);
    stop();

    requestMonth('2026-07');
    expect(handler).not.toHaveBeenCalled();
  });

  // The form calls this on a page where the history may not be mounted at all
  // (the Manage section, a narrow screen). It has to be a no-op, not a throw.
  it('is harmless with nothing listening', () => {
    expect(() => requestMonth('2026-07')).not.toThrow();
  });
});
