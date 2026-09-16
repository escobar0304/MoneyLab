/**
 * Placeholders for content that is on its way.
 *
 * Deliberately shaped like the thing being waited for rather than being a
 * spinner: a panel that resolves into the layout it was already occupying
 * doesn't reflow the page underneath it, and the reader can start parsing where
 * things will be before they arrive.
 *
 * `motion-safe:` on the pulse, not a media query in CSS, because the whole
 * effect here *is* the animation — with reduced motion the bars simply sit
 * still, which is the correct fallback rather than a missing one.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

/** A chart's silhouette — axis-ish bars of uneven height under a caption. */
export function ChartSkeleton({ label }: { label?: string }) {
  const heights = ['h-16', 'h-24', 'h-12', 'h-28', 'h-20', 'h-32', 'h-14'];
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 px-6">
      <div className="flex h-32 w-full items-end justify-center gap-2">
        {heights.map((h, i) => (
          <Skeleton key={i} className={`w-6 ${h}`} />
        ))}
      </div>
      {label && <span className="text-xs text-ink-muted">{label}</span>}
    </div>
  );
}
