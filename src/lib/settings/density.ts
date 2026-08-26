import { useEffect, useState } from 'react';

export type Density = 'comfortable' | 'compact';

const KEY = 'moneylab-density';
const CHANGED = 'moneylab-density-changed';

export function readDensity(): Density {
  return localStorage.getItem(KEY) === 'compact' ? 'compact' : 'comfortable';
}

/**
 * Writes the choice to the document root, where the `--pad-*` tokens live.
 *
 * Exported so it can be called from the entry point before React mounts —
 * flipping density after first paint would show one frame of the wrong layout
 * on every single load, which is worse than not offering the setting.
 */
export function applyDensity(density: Density): void {
  document.documentElement.dataset.density = density;
}

/** The density setting, kept in step across every component that shows it. */
export function useDensity(): [Density, (next: Density) => void] {
  const [density, setDensity] = useState<Density>(readDensity);

  useEffect(() => {
    const sync = () => setDensity(readDensity());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  const change = (next: Density) => {
    localStorage.setItem(KEY, next);
    applyDensity(next);
    setDensity(next);
    window.dispatchEvent(new Event(CHANGED));
  };

  return [density, change];
}
