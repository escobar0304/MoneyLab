// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, ErrorState } from './primitives';

describe('EmptyState', () => {
  it('shows the title on its own', () => {
    render(<EmptyState title="No goals yet" />);
    expect(screen.getByText('No goals yet')).toBeInTheDocument();
  });

  it('adds the description when there is one', () => {
    render(<EmptyState title="No goals yet" description="A goal earmarks part of your balance." />);
    expect(screen.getByText(/earmarks part of your balance/)).toBeInTheDocument();
  });

  // The icon is opt-in because a chart-level empty sits inside a card that
  // already names it, and stamping one there is decoration competing with the
  // eleven panels around it.
  it('renders no icon unless given one', () => {
    const { container, rerender } = render(<EmptyState title="Nothing" />);
    expect(container.querySelector('svg')).toBeNull();

    rerender(<EmptyState title="Nothing" icon={<svg data-testid="mark" />} />);
    expect(screen.getByTestId('mark')).toBeInTheDocument();
  });

  it('calls the primary action', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="No goals yet" action={{ label: 'Create a goal', onClick }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create a goal' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps the two actions apart', async () => {
    const primary = vi.fn();
    const secondary = vi.fn();
    render(
      <EmptyState
        title="Nothing held yet"
        action={{ label: 'Add a holding', onClick: primary }}
        secondaryAction={{ label: 'Import instead', onClick: secondary }}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import instead' }));
    expect(secondary).toHaveBeenCalledOnce();
    expect(primary).not.toHaveBeenCalled();
  });

  it('renders no buttons when no action was given', () => {
    render(<EmptyState title="Not enough history yet" description="Two months are needed." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('announces itself, so it is not colour alone that carries the failure', () => {
    const { container } = render(<ErrorState message="Couldn't reach TradingView" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText("Couldn't reach TradingView")).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('offers a retry only when one can work', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="Couldn't reach it" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<ErrorState message="Couldn't reach it" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the detail line when given one', () => {
    render(<ErrorState message="Couldn't reach it" detail="The rest of MoneyLab works offline." />);
    expect(screen.getByText(/works offline/)).toBeInTheDocument();
  });
});
