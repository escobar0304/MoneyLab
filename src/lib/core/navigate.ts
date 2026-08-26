const EVENT = 'moneylab:navigate';

export interface NavigateDetail {
  tab: string;
  /** Entries-specific: which sub-section to land on. */
  section?: 'log' | 'manage';
}

/** The most recent request, until the target tab's component consumes it. */
let pending: NavigateDetail | null = null;

/**
 * Cross-tree tab navigation for the rare component below the app root that
 * needs to switch tabs on its own — "go look at your Subscriptions" from a
 * card on Overview, say. A custom event rather than prop-drilling a callback
 * down through AppShell, matching how live-price toggling already syncs
 * across the tree without a dedicated store slice for it.
 *
 * Every other tab is a lazy chunk, so the destination component usually isn't
 * mounted — and therefore isn't listening — at the moment this fires. `pending`
 * covers that: the event serves a listener that's already up, and
 * `consumePendingSection` serves one about to mount for the first time.
 */
export function requestNavigate(detail: NavigateDetail) {
  pending = detail;
  window.dispatchEvent(new CustomEvent<NavigateDetail>(EVENT, { detail }));
}

/** Returns an unsubscribe function, for a `useEffect` cleanup. */
export function onNavigate(handler: (detail: NavigateDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<NavigateDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/**
 * Reads and clears a pending request for `tab`, for use in that tab's own
 * `useState` initializer — the one place code runs before a fresh mount's
 * `useEffect` has had a chance to subscribe to the live event.
 */
export function consumePendingSection(tab: string): NavigateDetail['section'] | undefined {
  if (pending?.tab !== tab) return undefined;
  const section = pending.section;
  pending = null;
  return section;
}
