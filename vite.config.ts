import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Inside a container the source arrives over a bind mount, and filesystem
// events don't reliably cross that boundary (notably from a Windows host), so
// the watcher never fires and hot reload silently stops working. Polling fixes
// it, but costs CPU — so it's opt-in via the env var the dev service sets,
// leaving native `npm run dev` on efficient native events.
const usePolling = process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'node',
  },
});
