import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only registers its own auto-cleanup when Vitest runs with
// `globals: true`. This project doesn't, so without unmounting here every
// render would pile up in the same document and the second test in a file
// starts failing with "found multiple elements" — a failure that looks like a
// component bug and isn't.
afterEach(cleanup);
