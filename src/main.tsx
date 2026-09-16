import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyDensity, readDensity } from './lib/settings/density';
import { applyPrivacy, readPrivacy } from './lib/settings/privacy';
// Self-hosted rather than pulled from a font CDN, for the same reason the
// ledger never leaves the browser: a Google Fonts request would hand over the
// reader's IP on every cold load, and the app would stop looking like itself
// the moment it was opened offline — which, for an offline-first PWA, is a
// state it is expressly built to be used in. Bundled variable faces are one
// file per family and are cached by the service worker with everything else.
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

// Before the first render. Density here avoids a frame at the wrong size;
// privacy here avoids a frame with every figure legible, which for that feature
// would be the whole failure.
applyDensity(readDensity());
applyPrivacy(readPrivacy());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
