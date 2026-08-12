import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Runs against the production build rather than the dev server: the things most
 * worth catching here — a lazy route that fails to resolve, a chunk that never
 * loads, the service worker taking over navigation — only exist after a build.
 * `npm run preview` serves exactly what the Docker image would.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // A stray `test.only` committed to the repo silently reduces CI to one test.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    // `localhost`, not `127.0.0.1`: Vite's preview server binds to the hostname,
    // which resolves to ::1 first on Windows — the loopback IPv4 address is then
    // never listening and the server looks like it failed to start.
    baseURL: 'http://localhost:4173',
    // `page.route` does not intercept requests a service worker makes, and this
    // build ships one that caches exchange rates CacheFirst for a year. With the
    // worker active, a stubbed rate was silently bypassed and the test talked to
    // the real API — passing or failing depending on which got there first.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
