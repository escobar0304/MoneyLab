import { describe, it, expect } from 'vitest';
import { formatDateNumeric, browserDateOrderDiffers, LOCALE } from './format';

describe('formatDateNumeric', () => {
  // Day first, zero-padded, slash-separated: the order a Portuguese reader
  // expects, and the order the rest of the app already prints.
  it('prints a date the way the app prints every other date', () => {
    expect(formatDateNumeric('2026-09-21')).toBe('21/09/2026');
  });

  // The value handed in is the same `YYYY-MM-DD` string the date input holds.
  // Parsing it as bare ISO would place it at midnight UTC, which is the day
  // before in any timezone behind UTC — the app would echo a date one off from
  // the one in the field it sits under.
  it('does not shift the date across a timezone boundary', () => {
    expect(formatDateNumeric('2026-01-01')).toBe('01/01/2026');
    expect(formatDateNumeric('2026-12-31')).toBe('31/12/2026');
  });

  // The formatter used to build a Date from whatever it was handed, which is a
  // RangeError for everything that is not exactly `YYYY-MM-DD` — an empty
  // field, a half-typed value, a full timestamp. `Intl.format` throws on an
  // invalid date rather than degrading, and this is called during a render.
  it('returns an empty string rather than throwing on anything else', () => {
    for (const value of ['', '2026-09-21T10:00:00.000Z', '2026-9-1', '2026-13-45', 'not a date']) {
      expect(formatDateNumeric(value)).toBe('');
    }
  });
});

describe('browserDateOrderDiffers', () => {
  // Whatever the runtime's default locale is, the answer has to be a decision
  // and not a throw: this gates a visible hint under every date field.
  it('answers rather than throwing', () => {
    expect(typeof browserDateOrderDiffers()).toBe('boolean');
  });

  // The whole point is to be false for the reader the app is formatted for. If
  // this ever flips, every date field in the app grows a redundant caption.
  it('is false when the runtime already agrees with the app', () => {
    const sample = new Date(2026, 0, 22);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const runtimeMatchesApp =
      new Intl.DateTimeFormat(undefined, options).format(sample) ===
      new Intl.DateTimeFormat(LOCALE, options).format(sample);

    expect(browserDateOrderDiffers()).toBe(!runtimeMatchesApp);
  });
});
