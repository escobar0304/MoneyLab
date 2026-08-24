import { Reveal } from '../ui/Reveal';
import { HoldingsManager } from './HoldingsManager';

/**
 * What you own, on its own tab.
 *
 * Used to share a page with the watchlist and chart under "Markets" — but
 * owning ten shares of something and watching a symbol you don't hold are
 * different questions with different rhythms: this one changes when you trade,
 * that one changes when you're just looking around. Splitting them means
 * neither has to scroll past the other to get to what it actually wants.
 */
export function PortfolioView() {
  return (
    <Reveal className="space-y-3" from="start">
      <HoldingsManager />
    </Reveal>
  );
}
