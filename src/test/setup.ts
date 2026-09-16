import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only registers its own auto-cleanup when Vitest runs with
// `globals: true`. This project doesn't, so without unmounting here every
// render would pile up in the same document and the second test in a file
// starts failing with "found multiple elements" — a failure that looks like a
// component bug and isn't.
afterEach(cleanup);

// jsdom implements no `matchMedia`, and the motion layer asks it whether the
// reader prefers reduced motion before every animation — so any component that
// animates throws on render rather than failing an assertion, which reads as a
// component bug and isn't. Answering "no preference" runs the real code path,
// the one users on default settings get.
// The `typeof` guard is load-bearing: this file is the setup for every suite,
// and the derivation tests run in the node environment, where there is no
// window at all.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
