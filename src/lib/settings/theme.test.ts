// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readTheme, applyTheme } from './theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('readTheme', () => {
  // Paper is the default, and the inline script in index.html hard-codes the
  // same rule. If these two ever disagree the page paints one theme and then
  // swaps to the other, which is the exact flash the script exists to prevent.
  it('defaults to paper', () => {
    expect(readTheme()).toBe('paper');
  });

  it('returns ink once it has been chosen', () => {
    localStorage.setItem('moneylab-theme', 'ink');
    expect(readTheme()).toBe('ink');
  });

  // Anything else stored — a stale value from an older build, a hand-edited
  // key — resolves to the default rather than to an attribute nothing styles.
  it('falls back to paper for a value it does not recognise', () => {
    localStorage.setItem('moneylab-theme', 'midnight');
    expect(readTheme()).toBe('paper');
  });
});

describe('applyTheme', () => {
  it('writes the choice where the tokens read it', () => {
    applyTheme('ink');
    expect(document.documentElement.dataset.theme).toBe('ink');

    applyTheme('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');
  });
});
