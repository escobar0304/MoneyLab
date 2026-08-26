// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartCard } from './ChartCard';
import type { TableData } from '../../lib/insight/chartTables';

const table: TableData = {
  columns: ['Month', 'Spent'],
  rows: [
    ['August 2026', '1 200,00 €'],
    ['July 2026', '900,00 €'],
  ],
  numeric: [1],
};

describe('ChartCard', () => {
  it('shows the chart first and the table only on request', async () => {
    render(
      <ChartCard title="Spend" table={table}>
        <div data-testid="plot">chart</div>
      </ChartCard>
    );

    expect(screen.getByTestId('plot')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('plot')).not.toBeInTheDocument();
  });

  it('exposes every value from the chart as table text', async () => {
    render(
      <ChartCard title="Spend" table={table}>
        <div>chart</div>
      </ChartCard>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    for (const value of ['August 2026', '1 200,00 €', 'July 2026', '900,00 €']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it('labels the toggle for assistive tech and reflects its state', async () => {
    render(
      <ChartCard title="Spend" table={table}>
        <div>chart</div>
      </ChartCard>
    );
    const toggle = screen.getByRole('button', { name: 'Table' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-controls');

    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Chart' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('gives the table a caption naming what it is', async () => {
    render(
      <ChartCard title="Spend by category" table={table}>
        <div>chart</div>
      </ChartCard>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByRole('table', { name: 'Spend by category' })).toBeInTheDocument();
  });

  it('offers no toggle at all when there is no table to show', () => {
    render(
      <ChartCard title="Spend">
        <div>chart</div>
      </ChartCard>
    );
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
  });

  it('says so rather than rendering an empty table', async () => {
    render(
      <ChartCard title="Spend" table={{ columns: ['Month'], rows: [], numeric: [] }}>
        <div>chart</div>
      </ChartCard>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByText('No data for this period.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
