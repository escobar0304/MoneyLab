import { test, expect } from '@playwright/test';

/**
 * The symbol search proxy.
 *
 * TradingView's search endpoint answers 403 unless the request carries
 * `Origin: https://www.tradingview.com`, and Origin is a forbidden header that
 * page JavaScript cannot set — so this route is the only way the picker reaches
 * beyond its built-in catalogue. It is also invisible when it breaks: the app
 * quietly falls back to ~60 bundled instruments and simply looks worse, which is
 * how the failure was first reported rather than noticed.
 *
 * This needs the network, so it is the one test here that can fail for reasons
 * outside the repository.
 */
test.describe('symbol search proxy', () => {
  test('forwards to TradingView and comes back with results', async ({ request }) => {
    const response = await request.get('/tv-search?text=nvidia');
    expect(response.status(), 'a 403 here means the Origin header is not reaching TradingView').toBe(200);

    const body = await response.json();
    const symbols: unknown[] = Array.isArray(body) ? body : (body?.symbols ?? []);
    expect(symbols.length).toBeGreaterThan(0);
  });

  test('is configured identically for the dev server and the container', async () => {
    // Three places have to agree, and two of them are not exercised by any other
    // test: vite.config.ts covers `npm run dev` and `npm run preview`, nginx.conf
    // covers the Docker image.
    const { readFile } = await import('node:fs/promises');
    const vite = await readFile('vite.config.ts', 'utf8');
    const nginx = await readFile('nginx.conf', 'utf8');

    expect(vite).toContain("proxy: tvSearchProxy");
    expect(vite.match(/proxy: tvSearchProxy/g)?.length, 'server and preview both need it').toBe(2);
    expect(vite).toContain("setHeader('Origin', 'https://www.tradingview.com')");
    expect(nginx).toContain('proxy_set_header Origin "https://www.tradingview.com"');
  });
});
