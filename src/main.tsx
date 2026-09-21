import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { applyDensity, readDensity } from './lib/settings/density';
import { applyTheme, readTheme } from './lib/settings/theme';
import { applyPrivacy, readPrivacy } from './lib/settings/privacy';
// Self-hosted rather than pulled from a font CDN, for the same reason the
// ledger never leaves the browser: a Google Fonts request would hand over the
// reader's IP on every cold load, and the app would stop looking like itself
// the moment it was opened offline — which, for an offline-first PWA, is a
// state it is expressly built to be used in. Bundled variable faces are one
// file per family and are cached by the service worker with everything else.
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

// Before the first render. Density here avoids a frame at the wrong size;
// privacy here avoids a frame with every figure legible, which for that feature
// would be the whole failure.
applyDensity(readDensity());
// Before React mounts, for the same reason density is: flipping after first
// paint flashes the wrong theme on every load, and a white flash on the dark
// one is the worst version of that.
applyTheme(readTheme());
applyPrivacy(readPrivacy());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The outermost net. The per-view boundary inside App keeps the shell
        alive for a crash in one tab; this one is for a crash that takes the
        shell with it, where the alternative is a white page and no way to
        reach the data. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
