import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Inside a container the source arrives over a bind mount, and filesystem
// events don't reliably cross that boundary (notably from a Windows host), so
// the watcher never fires and hot reload silently stops working. Polling fixes
// it, but costs CPU — so it's opt-in via the env var the dev service sets,
// leaving native `npm run dev` on efficient native events.
const usePolling = process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MoneyLab',
        short_name: 'MoneyLab',
        description: 'Personal finance, kept entirely on your own device.',
        // Matches --color-surface-0 so the splash screen doesn't flash a
        // different colour than the app it's about to show.
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app is a local-first ledger with no backend, so the whole shell is
        // safe to precache — offline is the normal case, not a degraded one.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // TradingView is the one genuinely networked feature. Never precache it,
        // and never serve a stale chart: no data is clearer than old prices.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.frankfurter\.dev\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fx-rates',
              // Historical ECB rates for a past date never change, so they can
              // be cached hard — which also makes re-editing an old entry work
              // offline.
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy libraries out of the app chunk. They change far less
        // often than the app does, so a rebuild doesn't invalidate them in the
        // browser cache.
        //
        // Function form, not the object form: Vite 8 bundles with rolldown,
        // which only accepts a callback here. Recharts' d3 dependencies are
        // matched explicitly, otherwise they stay behind in the app chunk and
        // the split saves almost nothing.
        manualChunks(id: string) {
          if (/node_modules[\\/](recharts|d3-|victory-|internmap|decimal\.js)/.test(id)) return 'charts';
          if (/node_modules[\\/](gsap|@gsap)/.test(id)) return 'motion';
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
  server: {
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      // TradingView's symbol search rejects any request whose Referer is not
      // tradingview.com, and Referer is a forbidden header that page JS cannot
      // set — so the typeahead cannot call it directly. Forwarding it here keeps
      // the dev server behaving like the nginx image, which does the same thing.
      '/tv-search': {
        target: 'https://symbol-search.tradingview.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tv-search/, '/symbol_search/v3/') + '&hl=0&lang=en&domain=production',
        headers: { Referer: 'https://www.tradingview.com/' },
      },
    },
  },
  test: {
    // Logic tests run in node; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock, so the fast majority stay fast.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest owns src/, Playwright owns e2e/. Without this, Vitest's default
    // glob collects the E2E specs too and each one fails on importing
    // `@playwright/test` — six red files with nothing actually broken.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
