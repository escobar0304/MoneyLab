import { describe, it, expect } from 'vitest';
import { TABS, PRIMARY_TABS, SECONDARY_TABS, tabDef } from './tabs';

describe('the phone tab bar', () => {
  // A tab that is in neither list is unreachable on a phone: it is not on the
  // bar and it is not in the sheet, and nothing anywhere would say so.
  it('places every tab either on the bar or in the sheet', () => {
    expect([...PRIMARY_TABS, ...SECONDARY_TABS].sort()).toEqual(TABS.map((t) => t.id).sort());
  });

  it('never lists the same tab twice', () => {
    const all = [...PRIMARY_TABS, ...SECONDARY_TABS];
    expect(new Set(all).size).toBe(all.length);
  });

  // Four plus More. A fifth destination would push the bar to six slots, which
  // is under the 44px touch target on the narrowest phone still in use.
  it('keeps the bar to four destinations', () => {
    expect(PRIMARY_TABS).toHaveLength(4);
  });
});

describe('tabDef', () => {
  it('finds a tab by id', () => {
    expect(tabDef('overview').label).toBe('Overview');
  });

  it('throws on an id that is not a tab, rather than rendering a blank slot', () => {
    // @ts-expect-error — the guard exists for the case the type cannot catch,
    // such as a tab id read back from storage or a URL.
    expect(() => tabDef('nope')).toThrow();
  });
});
