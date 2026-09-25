import { describe, it, expect } from 'vitest';
import { embedTarget, sandboxFor } from './embedOrigin';

/**
 * `sandboxFor` decides whether third-party code gets `allow-same-origin`, which
 * is the single flag standing between a TradingView bundle and the ledger. So
 * these test the refusals harder than the happy path: every case that cannot be
 * *proved* to be a different origin has to come back un-isolated.
 *
 * `VITE_EMBED_PORT` is unset under vitest, which is itself the most important
 * case — an unconfigured build must fall back to the safe behaviour rather than
 * guess a port.
 */
describe('embedTarget', () => {
  it('stays on the app origin when no embed port is configured', () => {
    const target = embedTarget('http://localhost:8080');
    expect(target).toEqual({ origin: 'http://localhost:8080', isolated: false });
  });

  it('never claims isolation it cannot prove', () => {
    for (const origin of ['http://localhost:8080', 'https://moneylab.example', 'not an origin', '']) {
      expect(embedTarget(origin).isolated).toBe(false);
    }
  });
});

describe('sandboxFor', () => {
  // Without a proven-different origin the frame keeps the restrictive sandbox,
  // chart or no chart. Failing towards isolation is the point.
  it('withholds allow-same-origin from a same-origin frame', () => {
    const sandbox = sandboxFor({ origin: 'http://localhost:8080', isolated: false });
    expect(sandbox).not.toContain('allow-same-origin');
    expect(sandbox).toContain('allow-scripts');
  });

  // `allow-scripts` plus `allow-same-origin` on a same-origin frame lets the
  // frame reach into the parent and strip its own sandbox attribute — which is
  // why the pair is only ever handed out across an origin boundary.
  it('grants allow-same-origin only across an origin boundary', () => {
    const sandbox = sandboxFor({ origin: 'http://localhost:8081', isolated: true });
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).toContain('allow-scripts');
  });
});
