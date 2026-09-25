import { CHART_INK, onPaper } from '../../lib/insight/chartTheme';
import { SandboxedEmbed } from './SandboxedEmbed';

export type Interval = '5' | '15' | '60' | 'D' | 'W' | 'M';
export type Style = '1' | '2' | '3';

/**
 * TradingView's Advanced Chart embed.
 *
 * All the mounting, teardown and retry mechanics live in `SandboxedEmbed`,
 * which runs this in a frame of its own so the widget cannot reach the ledger.
 * What is left here is the configuration, which is the only part that is
 * actually about charts.
 */
export function TradingViewChart({
  symbol,
  interval,
  style,
  height = 520,
}: {
  symbol: string;
  interval: Interval;
  style: Style;
  height?: number;
}) {
  return (
    <SandboxedEmbed
      widget="advanced-chart"
      title={`${symbol} chart`}
      height={height}
      // The chart is the thing the reader came to this tab for, so it loads
      // straight away rather than waiting to be scrolled near.
      lazy={false}
      config={{
        autosize: false,
        width: '100%',
        height,
        symbol,
        interval,
        timezone: 'Europe/Lisbon',
        // Follows the app rather than being pinned to one look. `backgroundColor`
        // below already tracks the theme — `CHART_INK` is a set of getters — so
        // leaving this hard-coded put a dark chart on a light page, with the
        // surface colour correct and everything drawn on it wrong.
        theme: onPaper() ? 'light' : 'dark',
        style,
        locale: 'en',
        // Match the app's own surface so the embed doesn't read as a foreign panel.
        backgroundColor: CHART_INK.surface,
        gridColor: CHART_INK.gridline,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        calendar: false,
        support_host: 'https://www.tradingview.com',
      }}
    />
  );
}
