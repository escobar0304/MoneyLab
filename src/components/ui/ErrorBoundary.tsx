import { Component, type ErrorInfo, type ReactNode } from 'react';
import { rescueExport } from '../../lib/core/rescue';
import { isStaleChunkError, recoverFromStaleChunk } from '../../lib/core/staleChunk';
import { IconWarning, IconRefresh } from './icons';

interface Props {
  children: ReactNode;
  /** When this changes, a caught error is cleared. Lets a per-view boundary
   * recover simply by the reader switching tabs, instead of stranding them on
   * the fallback until they reload. */
  resetKey?: unknown;
  /** Set on the per-view boundary, where the sidebar is still on screen and
   * still works, so the copy doesn't claim the whole app is down. */
  scope?: 'app' | 'view';
}

interface State {
  error: Error | null;
  rescue: string | null;
  /** Set when the error was a view chunk that no longer exists, so the fallback
   * can say "a new version is installed" instead of "something broke". */
  stale: boolean;
}

/**
 * Catches a render crash and says the one thing the reader needs to hear.
 *
 * For most apps a white screen is an annoyance. For this one it looks like the
 * only copy of your finances just disappeared — there is no server to fall back
 * on, so "the page is broken" and "my data is gone" are indistinguishable from
 * the outside. They are not the same thing: the ledger is a JSON blob in
 * `localStorage` that a failed render cannot touch. So the fallback leads with
 * that, and then offers to download it, because being told your data is safe is
 * worth much less than being handed it.
 *
 * A class component because that is still the only way to catch a render error
 * in React. It uses no store, no motion and no lazy chunk: a fallback that can
 * fail for the same reason as the thing it is catching is not a fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, rescue: null, stale: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, stale: isStaleChunkError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A view chunk that 404s is not a crash: the service worker installed a new
    // version underneath a tab that was left open, and the fix is to reload
    // onto it. Attempted here rather than in `getDerivedStateFromError`, which
    // has to stay pure — and guarded against looping, so a genuinely broken
    // deploy falls through to the message below instead of reloading forever.
    if (isStaleChunkError(error) && recoverFromStaleChunk()) return;

    // No reporting service to send this to — by design, nothing leaves the
    // device — so the console is the whole audit trail.
    console.error('MoneyLab crashed while rendering:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, rescue: null, stale: false });
    }
  }

  private download = () => {
    const result = rescueExport();
    this.setState({
      rescue: result.ok
        ? result.count > 0
          ? `Saved a copy of ${result.count} entries.`
          : 'Saved a raw copy of the stored data.'
        : result.reason,
    });
  };

  render() {
    const { error, rescue, stale } = this.state;
    if (!error) return this.props.children;

    const whole = this.props.scope !== 'view';

    return (
      <div className={whole ? 'flex min-h-screen items-center justify-center p-6' : 'py-12'}>
        <div className="mx-auto w-full max-w-lg rounded-xl border border-hairline bg-surface-1 p-6 text-center">
          {/* Red says "this failed". An update that installed correctly did
              not fail, so it gets the accent and the refresh mark instead. */}
          <span
            className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${
              stale
                ? 'bg-accent/12 text-accent ring-accent/25'
                : 'bg-critical/12 text-critical-text ring-critical/25'
            }`}
          >
            {stale ? <IconRefresh className="h-5.5 w-5.5" /> : <IconWarning className="h-5.5 w-5.5" />}
          </span>

          <h1 className="t-title text-ink">
            {stale
              ? 'A new version is ready'
              : whole
                ? 'Something broke while drawing the page'
                : 'This tab failed to draw'}
          </h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink-secondary">
            {stale ? (
              <>
                This tab was open while an update was installed, so part of it is no longer on
                disk. Your ledger is untouched — reloading picks up the new version.
              </>
            ) : (
              <>
                Your ledger is untouched. It's stored in this browser and nothing here writes to
                it — {whole ? 'reloading' : 'switching tabs'} should bring everything back.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-display flex cursor-pointer items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-hover"
            >
              <IconRefresh className="h-4 w-4" />
              Reload
            </button>
            {/* Offering a rescue export for an update would imply the data is
                at risk, which is exactly the wrong thing to suggest here. */}
            {!stale && (
              <button
                type="button"
                onClick={this.download}
                className="font-display cursor-pointer rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink-muted hover:bg-border"
              >
                Download a copy of my data
              </button>
            )}
          </div>

          {rescue && <p className="mt-3 text-xs text-ink-muted">{rescue}</p>}

          <details className="mt-5 text-left">
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-secondary">
              What went wrong
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-hairline bg-surface-0 p-3 text-xs text-ink-muted">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
