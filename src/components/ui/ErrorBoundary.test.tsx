// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ throws }: { throws: boolean }): React.ReactElement {
  if (throws) throw new Error('kaboom');
  return <p>the tab rendered</p>;
}

beforeEach(() => {
  // React logs every caught error, and the boundary logs its own — neither is
  // a failure here, and together they bury the actual test output.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('renders its children while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('the tab rendered')).toBeInTheDocument();
  });

  // The whole point of the fallback: the reader has to be told the ledger
  // survived, because a blank page in a local-only app reads as data loss.
  it('catches a render crash and says the ledger is untouched', () => {
    render(
      <ErrorBoundary>
        <Boom throws={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Your ledger is untouched/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download a copy of my data/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });

  it('exposes the underlying error for anyone who opens the details', () => {
    render(
      <ErrorBoundary>
        <Boom throws={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/kaboom/)).toBeInTheDocument();
  });

  it('tells a view-scoped crash apart from one that took the shell down', () => {
    const { unmount } = render(
      <ErrorBoundary scope="view">
        <Boom throws={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('This tab failed to draw')).toBeInTheDocument();
    unmount();

    render(
      <ErrorBoundary>
        <Boom throws={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something broke while drawing the page')).toBeInTheDocument();
  });

  // Switching tabs is the recovery for a per-view boundary — without this the
  // reader is stranded on the fallback until they reload the whole app.
  it('recovers when the reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary scope="view" resetKey="plan">
        <Boom throws={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('This tab failed to draw')).toBeInTheDocument();

    rerender(
      <ErrorBoundary scope="view" resetKey="overview">
        <Boom throws={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('the tab rendered')).toBeInTheDocument();
  });

  it('stays in the fallback while the reset key is unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary scope="view" resetKey="plan">
        <Boom throws={true} />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary scope="view" resetKey="plan">
        <Boom throws={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('This tab failed to draw')).toBeInTheDocument();
  });
});

/** What React throws when a lazy view's chunk is no longer on disk — the tab
 * was open while the service worker installed a new version underneath it. */
function StaleChunk(): React.ReactElement {
  throw new TypeError('Failed to fetch dynamically imported module: https://app.test/assets/PlanView-Dw4EaKLg.js');
}

describe('ErrorBoundary and a tab left open across a deploy', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  });

  afterEach(() => sessionStorage.clear());

  it('reloads onto the installed version rather than showing a crash', () => {
    render(
      <ErrorBoundary>
        <StaleChunk />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // When the reload cannot help — a chunk missing from the new build, not just
  // from the old cache — the reader gets told what actually happened.
  it('says a new version is ready instead of claiming a crash', () => {
    sessionStorage.setItem('moneylab:chunk-reload-at', String(Date.now()));

    render(
      <ErrorBoundary>
        <StaleChunk />
      </ErrorBoundary>
    );

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /A new version is ready/ })).toBeInTheDocument();
    expect(screen.queryByText(/Something broke/)).not.toBeInTheDocument();
  });

  // An update puts nothing at risk, and offering a rescue export would imply
  // it does — which is the opposite of what this screen needs to convey.
  it('does not offer a data rescue for an update', () => {
    sessionStorage.setItem('moneylab:chunk-reload-at', String(Date.now()));

    render(
      <ErrorBoundary>
        <StaleChunk />
      </ErrorBoundary>
    );

    expect(screen.queryByRole('button', { name: /Download a copy of my data/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });

  // A genuine crash must keep the old treatment — the detection is a substring
  // match, so this is the guard against it widening.
  it('still treats a real crash as a crash', () => {
    render(
      <ErrorBoundary>
        <Boom throws={true} />
      </ErrorBoundary>
    );

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText(/Your ledger is untouched/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download a copy of my data/ })).toBeInTheDocument();
  });
});
