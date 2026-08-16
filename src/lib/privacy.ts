import { useEffect, useState } from 'react';

const KEY = 'moneylab-privacy';
const CHANGED = 'moneylab-privacy-changed';

export function readPrivacy(): boolean {
  return localStorage.getItem(KEY) === '1';
}

/**
 * Writes the mode to the document root, where the blur rules key off it.
 *
 * Exported so the entry point can call it before React mounts. Turning it on
 * after first paint would flash every figure in the app for one frame — which,
 * for the one feature whose entire job is that nobody sees the figures, would
 * make it worse than useless.
 */
export function applyPrivacy(on: boolean): void {
  if (on) document.documentElement.dataset.privacy = 'on';
  else delete document.documentElement.dataset.privacy;
}

/** Whether amounts are hidden, kept in step across every component. */
export function usePrivacy(): [boolean, (next: boolean) => void] {
  const [hidden, setHidden] = useState(readPrivacy);

  useEffect(() => {
    const sync = () => setHidden(readPrivacy());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  const change = (next: boolean) => {
    localStorage.setItem(KEY, next ? '1' : '0');
    applyPrivacy(next);
    setHidden(next);
    window.dispatchEvent(new Event(CHANGED));
  };

  return [hidden, change];
}
