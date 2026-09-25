/**
 * Where the TradingView frame is served from, and whether that is somewhere
 * other than this app.
 *
 * The frame is sandboxed without `allow-same-origin`, which is what keeps
 * third-party code away from the `localStorage` the whole ledger lives in. The
 * cost of that was discovered the hard way: sandbox flags are inherited by
 * nested browsing contexts, so TradingView's own inner frame gets an opaque
 * origin too, its chart cannot reach the storage it expects, and the panel
 * renders as a blank rectangle. The shims in `public/embed.js` patch our frame;
 * they cannot reach inside theirs.
 *
 * Serving the frame from a *different origin* dissolves the conflict.
 * `allow-same-origin` then makes the frame same-origin with that origin — not
 * with the app — so the widget gets its storage back while `parent.localStorage`
 * stays a cross-origin access the browser refuses. Same protection, working
 * chart.
 *
 * `VITE_EMBED_PORT` is the port that second origin is published on. The
 * container sets it; anything else leaves it unset and keeps the old behaviour,
 * which is safe but cannot draw the chart. Safety is the default precisely
 * because a misconfiguration must fail towards isolation, never away from it.
 */

const CONFIGURED_PORT = (import.meta.env?.VITE_EMBED_PORT ?? '').trim();

export interface EmbedTarget {
  /** Absolute origin the frame is loaded from. */
  origin: string;
  /** True only when that origin is provably not this app's. */
  isolated: boolean;
}

/**
 * Resolved per call rather than once at module scope: this is read during
 * render, and a module-level constant would freeze it before the document
 * exists in a test environment.
 */
export function embedTarget(appOrigin: string = window.location.origin): EmbedTarget {
  if (!CONFIGURED_PORT) return { origin: appOrigin, isolated: false };

  let candidate: URL;
  try {
    candidate = new URL(appOrigin);
    candidate.port = CONFIGURED_PORT;
  } catch {
    // An origin we cannot parse is an origin we cannot prove is different.
    return { origin: appOrigin, isolated: false };
  }

  // The comparison is the whole safety check, so it compares resolved origins
  // rather than the port strings: `:80` against an https app, or a port equal
  // to the one already in use, must both come out as "not isolated".
  const isolated = candidate.origin !== appOrigin;
  return { origin: isolated ? candidate.origin : appOrigin, isolated };
}

/**
 * The sandbox attribute for the frame.
 *
 * `allow-same-origin` is granted only against a proven-different origin. Handing
 * it to a same-origin frame would be worse than having no sandbox at all: the
 * combination of `allow-scripts` and `allow-same-origin` lets the frame reach
 * out and remove its own sandbox attribute from the parent document.
 */
export function sandboxFor(target: EmbedTarget): string {
  const base = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
  return target.isolated ? `${base} allow-same-origin` : base;
}
