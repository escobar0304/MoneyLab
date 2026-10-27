// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readTheme, applyTheme, THEME_SURFACE } from './theme';
// As text, through Vite, so the app's tsconfig needs no Node types to check this.
import initScript from '../../../public/theme-init.js?raw';
import indexHtml from '../../../index.html?raw';

/** The two metas index.html ships, at the defaults it ships them with. */
function resetHead() {
  document.head.innerHTML =
    '<meta name="theme-color" content="#faf8f5" /><meta name="color-scheme" content="light" />';
}

function metas() {
  return {
    theme: document.documentElement.dataset.theme,
    scheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content'),
    bar: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  };
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  resetHead();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readTheme', () => {
  // Paper is the default, and public/theme-init.js hard-codes the same rule.
  // If these two ever disagree the page paints one theme and then swaps to the
  // other, which is the exact flash the script exists to prevent.
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

  it('falls back to paper when storage refuses access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
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

  // Otherwise switching mid-session leaves a light browser bar and light form
  // controls over a dark page until the next reload.
  it('keeps the browser chrome metas in step', () => {
    applyTheme('ink');
    expect(metas()).toEqual({ theme: 'ink', scheme: 'dark', bar: THEME_SURFACE.ink });

    applyTheme('paper');
    expect(metas()).toEqual({ theme: 'paper', scheme: 'light', bar: THEME_SURFACE.paper });
  });
});

describe('first paint', () => {
  // public/theme-init.js runs before any module can be imported, so it cannot
  // share code with theme.ts — it repeats it. These run the real file and hold
  // it to the same answer as readTheme + applyTheme for every stored state.
  const cases: [string, () => void][] = [
    ['nothing stored', () => {}],
    ['ink stored', () => localStorage.setItem('moneylab-theme', 'ink')],
    ['an unknown value stored', () => localStorage.setItem('moneylab-theme', 'midnight')],
    [
      'storage refusing access',
      () =>
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new DOMException('denied', 'SecurityError');
        }),
    ],
  ];

  for (const [name, arrange] of cases) {
    it(`theme-init.js agrees with the app with ${name}`, () => {
      arrange();
      new Function(initScript)();
      const painted = metas();

      delete document.documentElement.dataset.theme;
      resetHead();
      applyTheme(readTheme());
      expect(painted).toEqual(metas());
    });
  }

  // The app's policy is script-src 'self', which refuses inline script. The dev
  // server sends no policy, so an inline script works in every local run and
  // silently does nothing behind nginx — this is the only place it is caught.
  it('index.html carries no inline script', () => {
    const inline = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
      ([, attrs, body]) => !/\bsrc=/.test(attrs) && body.trim() !== '',
    );
    expect(inline).toEqual([]);
  });

  // Classic and synchronous, or it runs after the first paint and the flash is back.
  it('index.html loads theme-init.js in the head, blocking', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('</head>'));
    const tag = head.match(/<script\b[^>]*src="\/theme-init\.js"[^>]*>/)?.[0];
    expect(tag).toBeDefined();
    expect(tag).not.toMatch(/\b(defer|async|type=)/);
  });
});
