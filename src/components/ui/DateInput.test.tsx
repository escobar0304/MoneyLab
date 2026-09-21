// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateInput } from './primitives';

/**
 * These exist because of a specific failure, and they are shaped to catch it
 * again rather than to describe the component.
 *
 * `DateInput` shipped rendering *itself* instead of `Input` — a bulk rewrite of
 * every `<Input type="date">` in the repo also rewrote the one inside the new
 * component. It typechecked, 511 unit tests passed, the build was clean, and
 * the only page without a date field on it is the empty one, so every
 * screenshot looked right. It took a CI run down and cost most of an afternoon.
 *
 * Rendering the thing once, anywhere, would have caught it: infinite recursion
 * overflows the stack rather than hanging, so this fails loudly.
 */
describe('DateInput', () => {
  it('renders exactly one date field, and does not render itself', () => {
    const { container } = render(<DateInput value="2026-09-21" onChange={() => {}} />);
    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].type).toBe('date');
    expect(inputs[0].value).toBe('2026-09-21');
  });

  it('passes attributes through to the native control', () => {
    render(<DateInput value="2026-09-21" min="2026-01-01" max="2026-12-31" onChange={() => {}} />);
    const input = screen.getByDisplayValue('2026-09-21');
    expect(input).toHaveAttribute('min', '2026-01-01');
    expect(input).toHaveAttribute('max', '2026-12-31');
  });

  // The echo is only drawn when the browser and the app disagree about date
  // order, so what it says is environment-dependent and not worth asserting.
  // That it never throws is the part that matters: the formatter behind it used
  // to raise a RangeError for anything that was not exactly `YYYY-MM-DD`, and a
  // throw from here takes down whichever view holds the field.
  it('survives values that are not a plain date', () => {
    for (const value of ['', '2026-09-21T10:00:00.000Z', '2026-9-1', 'not a date']) {
      expect(() => render(<DateInput value={value} onChange={() => {}} />)).not.toThrow();
    }
  });

  it('survives having no value at all', () => {
    expect(() => render(<DateInput onChange={() => {}} />)).not.toThrow();
  });
});
