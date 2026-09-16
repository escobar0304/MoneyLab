import { useState } from 'react';
import { useWatchlist } from '../../lib/investments/watchlist';
import { Button, Card, Input, Label, SectionTitle, EmptyState } from '../ui/primitives';
import { IconWatchlist, IconChart } from '../ui/icons';
import { Reveal } from '../ui/Reveal';
import { Segmented } from '../ui/Segmented';
import { SymbolPicker } from '../ui/SymbolPicker';
import { TradingViewChart, type Interval, type Style } from './TradingViewChart';
import { TechnicalAnalysisWidget, SymbolInfoWidget, SymbolNewsWidget, MarketOverviewWidget, HotlistsWidget } from './TradingViewWidgets';

const INTERVALS: { id: Interval; label: string }[] = [
  { id: '5', label: '5m' },
  { id: '15', label: '15m' },
  { id: '60', label: '1H' },
  { id: 'D', label: '1D' },
  { id: 'W', label: '1W' },
  { id: 'M', label: '1M' },
];

const STYLES: { id: Style; label: string }[] = [
  { id: '1', label: 'Candles' },
  { id: '3', label: 'Area' },
  { id: '2', label: 'Line' },
];

export function MarketsView() {
  const { symbols, selected, select, add, remove } = useWatchlist();
  const [interval, setInterval] = useState<Interval>('D');
  const [style, setStyle] = useState<Style>('1');
  const [adding, setAdding] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [draftLabel, setDraftLabel] = useState('');

  const current = symbols.find((s) => s.id === selected);

  const submit = () => {
    if (!draftId.trim()) return;
    add({ id: draftId, label: draftLabel });
    setDraftId('');
    setDraftLabel('');
    setAdding(false);
  };

  return (
    <Reveal className="space-y-3" from="start">
      {/* Not scoped to the watchlist on purpose — somewhere to look before you
          know what you're looking for, so it leads the page rather than
          following it. */}
      <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-2" from="start">
        <Card level="quiet">
          <SectionTitle>Explore markets</SectionTitle>
          <p className="mb-3 text-xs text-ink-muted">Indices, crypto and forex, independent of your watchlist.</p>
          <MarketOverviewWidget />
        </Card>
        <Card level="quiet">
          <SectionTitle>Trending today</SectionTitle>
          <p className="mb-3 text-xs text-ink-muted">Top gainers, losers and most active — U.S. markets.</p>
          <HotlistsWidget />
        </Card>
      </Reveal>

      <Card>
        <SectionTitle action={<Button variant="ghost" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add symbol'}</Button>}>
          Watchlist
        </SectionTitle>

        {adding && (
          <div className="mb-3 grid grid-cols-1 gap-3 rounded-lg border border-hairline bg-surface-0 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="tv-symbol">Search for a symbol</Label>
              <SymbolPicker
                id="tv-symbol"
                value={draftId}
                onChange={setDraftId}
                onPick={(hit) => {
                  setDraftId(hit.id);
                  // The ticker alone is not identification — "MC" is LVMH. Fill
                  // the name in from the result so the chip is readable later.
                  if (!draftLabel.trim()) setDraftLabel(hit.description || hit.label);
                }}
                label="TradingView symbol"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="tv-label">Display name (optional)</Label>
              <Input
                id="tv-label"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Tesla"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={submit} disabled={!draftId.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

        {symbols.length === 0 ? (
          <EmptyState
            icon={<IconWatchlist />}
            title="Watchlist is empty"
            description="Add a TradingView symbol such as NASDAQ:AAPL to get started."
            action={adding ? undefined : { label: 'Add a symbol', onClick: () => setAdding(true) }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {symbols.map((s) => {
              const isActive = s.id === selected;
              return (
                <span
                  key={s.id}
                  className={`group inline-flex items-center gap-1 rounded-lg border transition-colors duration-200 ${
                    isActive ? 'border-accent/40 bg-accent/12' : 'border-hairline hover:border-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => select(s.id)}
                    className={`cursor-pointer rounded-l-lg py-1.5 pl-2.5 text-left text-xs font-medium transition-colors duration-200 ${
                      isActive ? 'text-accent' : 'text-ink-secondary'
                    }`}
                  >
                    {s.label}
                    <span className="ml-1.5 text-ink-muted">{s.id}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    aria-label={`Remove ${s.label}`}
                    className="cursor-pointer rounded-r-lg px-2 py-1.5 text-ink-muted opacity-0 transition-opacity duration-200 hover:text-critical-text focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
          <h2 className="text-base font-semibold text-ink">{current ? `${current.label} · ${current.id}` : 'No symbol selected'}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={INTERVALS} value={interval} onChange={setInterval} label="Interval" />
            <Segmented options={STYLES} value={style} onChange={setStyle} label="Chart style" />
          </div>
        </div>

        {current ? (
          <TradingViewChart symbol={current.id} interval={interval} style={style} />
        ) : (
          <EmptyState icon={<IconChart />} title="Pick a symbol" description="Select one from the watchlist above." />
        )}

        <p className="mt-3 text-xs text-ink-muted">
          Charts by TradingView. Market data is fetched from TradingView in your browser — nothing from your ledger is sent anywhere.
        </p>
      </Card>

      {/* Scoped to the selected symbol, so it only appears once there is a
          symbol for it to be about. Technical Analysis gets the full width
          since its own tabs (1m/5m/1H/…) already make it wide; info and news
          stack in the narrower column beside it. */}
      {current && (
        <Reveal className="grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]" from="start">
          <Card>
            <SectionTitle>Technical rating</SectionTitle>
            <TechnicalAnalysisWidget symbol={current.id} />
          </Card>
          <div className="space-y-3">
            <Card>
              <SectionTitle>Symbol info</SectionTitle>
              <SymbolInfoWidget symbol={current.id} />
            </Card>
            <Card>
              <SectionTitle>News</SectionTitle>
              <SymbolNewsWidget symbol={current.id} height={280} />
            </Card>
          </div>
        </Reveal>
      )}
    </Reveal>
  );
}
