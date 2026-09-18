// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArrivals } from './arrivals';

describe('useArrivals', () => {
  // Otherwise opening the app animates every row on the page at once, which
  // reads as a loading screen rather than as anything arriving.
  it('treats nothing as new on the first render', () => {
    const { result } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });
    expect([...result.current]).toEqual([]);
  });

  it('reports the one row that was just logged', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b'] },
    });

    rerender({ ids: ['new', 'a', 'b'] });
    expect([...result.current]).toEqual(['new']);
  });

  it('goes quiet again on the render after', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a'] },
    });

    rerender({ ids: ['new', 'a'] });
    expect([...result.current]).toEqual(['new']);

    // Same list, a re-render for some unrelated reason: the row has already
    // made its entrance and must not make it again.
    rerender({ ids: ['new', 'a'] });
    expect([...result.current]).toEqual([]);
  });

  // Importing a statement adds hundreds of rows. Animating each one is a storm,
  // not feedback — and it is not something the reader did one of, either.
  it('stays silent for a bulk arrival', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a'] },
    });

    const imported = Array.from({ length: 40 }, (_, i) => `i${i}`);
    rerender({ ids: [...imported, 'a'] });
    expect([...result.current]).toEqual([]);
  });

  it('still animates a small batch, which is a real thing to do by hand', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a'] },
    });

    rerender({ ids: ['x', 'y', 'z', 'a'] });
    expect([...result.current].sort()).toEqual(['x', 'y', 'z']);
  });

  // Deleting is not arriving. A list that only shrank has nothing to announce.
  it('says nothing when a row is removed', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });

    rerender({ ids: ['a', 'c'] });
    expect([...result.current]).toEqual([]);
  });

  // Re-sorting reorders the same ids. Nothing arrived, so nothing should move.
  it('says nothing when the list is only reordered', () => {
    const { result, rerender } = renderHook(({ ids }) => useArrivals(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });

    rerender({ ids: ['c', 'a', 'b'] });
    expect([...result.current]).toEqual([]);
  });
});
