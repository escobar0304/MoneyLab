import { useEffect, useState } from 'react';

export type Theme = 'paper' | 'ink';

const KEY = 'moneylab-theme';
const CHANGED = 'moneylab-theme-changed';

/**
 * Which of the two looks the app wears.
 *
 * `paper` is light and editorial — rules and columns on a warm off-white, the
 * way a statement is printed. `ink` is the dark instrument panel this app was
 * before, kept rather than replaced: it was chosen for a real reason, which is
 * that a dark surface is easier on the eyes over a long sitting, and that
 * reason did not stop being true because the product got a second face.
 *
 * Paper is the default because it is the one that shows what the numbers are
 * for. Dark reads as a tool you operate; light reads as a document about you,
 * which is nearer what a personal ledger actually is.
 *
 * Follows `density.ts` exactly: a preference written to the document root,
 * where the tokens read it.
 */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'ink' ? 'ink' : 'paper';
  } catch {
    // Same fallback as public/theme-init.js when storage is refused. If they
    // disagreed here, the page would paint one theme and swap to the other.
    return 'paper';
  }
}

/**
 * Each theme's --color-surface-0, for the browser chrome that CSS cannot reach:
 * the phone's address bar and the installed app's title bar. Repeated in
 * public/theme-init.js, which runs before any module can be imported.
 */
export const THEME_SURFACE: Record<Theme, string> = { paper: '#faf8f5', ink: '#0b0d12' };

/**
 * Exported so the entry point can call it before React mounts. Flipping the
 * theme after first paint would flash the wrong one on every single load —
 * and a white flash on a dark theme is the worst version of that.
 *
 * The metas follow the choice too, or switching to ink mid-session would leave
 * a light browser bar over a dark page until the next reload.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme === 'ink' ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_SURFACE[theme]);
}

/** The theme setting, kept in step across every component that shows it. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);

  const change = (next: Theme) => {
    localStorage.setItem(KEY, next);
    applyTheme(next);
    setTheme(next);
    window.dispatchEvent(new Event(CHANGED));
  };

  return [theme, change];
}
