import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyDensity, readDensity } from './lib/density';
import { applyPrivacy, readPrivacy } from './lib/privacy';
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
