import { useEffect } from 'react';

export interface Shortcut {
  keys: string;
  description: string;
  group: 'Navigate' | 'Act';
}

/** Shown in the help overlay, and the single place the list is written down. */
export const SHORTCUTS: Shortcut[] = [
  { keys: 'G then O', description: 'Go to Overview', group: 'Navigate' },
  { keys: 'G then E', description: 'Go to Entries', group: 'Navigate' },
  { keys: 'G then P', description: 'Go to Plan', group: 'Navigate' },
  { keys: 'G then I', description: 'Go to IRS', group: 'Navigate' },
  { keys: 'G then H', description: 'Go to Portfolio (Holdings)', group: 'Navigate' },
  { keys: 'G then M', description: 'Go to Markets', group: 'Navigate' },
  { keys: 'G then S', description: 'Go to Settings', group: 'Navigate' },
  { keys: 'N', description: 'Log a new expense', group: 'Act' },
  { keys: 'Ctrl/⌘ Z', description: 'Undo the last change', group: 'Act' },
  { keys: '?', description: 'Show this list', group: 'Act' },
  { keys: 'Esc', description: 'Close an overlay', group: 'Act' },
];

/** True when the event came from somewhere the user is typing, in which case a
 * bare letter is a character and not a command. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** How long a `g` stays "armed" waiting for its second key. */
const CHORD_MS = 1200;

/**
 * Global keyboard handling.
 *
 * Two-key chords (`g` then `o`) rather than modifier combinations, because
 * single letters are free here — the app has no text-first surface — and every
 * useful modifier combination is already claimed by the browser.
 */
/** Kept in step with `Tab` in Sidebar.tsx; declared here so the keyboard layer
 * doesn't import a component just for a union. */
export type ShortcutTab = 'overview' | 'entries' | 'plan' | 'irs' | 'portfolio' | 'markets' | 'settings';

export function useShortcuts(handlers: {
  onNavigate: (tab: ShortcutTab) => void;
  onNewExpense: () => void;
  onUndo: () => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    let chordUntil = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl/⌘+Z is the one combination worth claiming, and it must work even
      // while typing — that is exactly when a mistake gets made.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (isTyping(e.target)) return; // let the field's own undo win
        e.preventDefault();
        handlers.onUndo();
        return;
      }

      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (Date.now() < chordUntil) {
        const tab = { o: 'overview', e: 'entries', p: 'plan', i: 'irs', h: 'portfolio', m: 'markets', s: 'settings' }[key];
        chordUntil = 0;
        if (tab) {
          e.preventDefault();
          handlers.onNavigate(tab as ShortcutTab);
          return;
        }
      }

      if (key === 'g') {
        chordUntil = Date.now() + CHORD_MS;
        return;
      }
      if (key === 'n') {
        e.preventDefault();
        handlers.onNewExpense();
        return;
      }
      if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        handlers.onHelp();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
