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
