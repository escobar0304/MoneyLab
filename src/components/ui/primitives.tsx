import { createPortal } from 'react-dom';
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type MouseEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { IconWarning } from './icons';

/**
 * How much a panel is meant to matter.
 *
 * `primary` for the one or two panels a page exists to show, `quiet` for
 * supporting detail that should not compete, `default` for everything else — and
 * most panels should stay default, or the levels stop meaning anything.
 */
export type CardLevel = 'primary' | 'default' | 'quiet';

const LEVELS: Record<CardLevel, string> = {
  primary: 'card-primary',
  default: 'bg-surface-1 border-hairline hover:border-border',
  quiet: 'card-quiet',
};

/**
 * Every panel in the app, on every page — so the spotlight is a property of the
 * design system rather than a dashboard-only flourish.
 *
 * The pointer position is written straight to CSS custom properties instead of
 * React state: a mousemove handler that called setState would re-render the
 * card's entire subtree (charts included) on every pointer sample.
 */
export function Card({
  children,
  className = '',
  level = 'default',
}: {
  children: ReactNode;
  className?: string;
  level?: CardLevel;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const track = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={track}
      onMouseEnter={() => ref.current?.style.setProperty('--spot-opacity', '1')}
      onMouseLeave={() => ref.current?.style.setProperty('--spot-opacity', '0')}
      className={`spotlight card-pad relative overflow-hidden rounded-xl border transition-colors duration-200 ${LEVELS[level]} ${className}`}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function SubsectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</p>;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-surface-2 text-ink hover:bg-border',
    danger: 'bg-critical text-white hover:brightness-110',
    ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  };
  return (
    <button
      className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Label({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="t-label mb-1 block" {...props}>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-ink-muted focus:border-accent ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-border bg-surface-0 px-2.5 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${props.className ?? ''}`}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-ink-secondary',
    good: 'bg-accent/15 text-positive',
    bad: 'bg-complement/15 text-complement',
    warn: 'bg-complement/15 text-complement',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/**
 * Which modals are open, innermost last.
 *
 * Needed the moment one overlay can open another — a drilled-down chart mark
 * opening an entry. Without it, both modals hear the same Escape and both close,
 * so backing out of the entry throws away the list you reached it from.
 */
const modalStack: symbol[] = [];

/**
 * Rendered through a portal to document.body, deliberately.
 *
 * `position: fixed` resolves against the viewport only while no ancestor has a
 * transform. Any GSAP tween that leaves a transform behind — a page transition,
 * a card reveal — silently promotes that ancestor to the containing block, and
 * an intermediate `overflow: hidden` (every Card has one) then clips the modal
 * to a sliver. The portal takes the modal out of that subtree entirely, so it
 * cannot be re-broken by an animation added somewhere far away later.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'md' | 'lg';
}) {
  useEffect(() => {
    const token = Symbol('modal');
    modalStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== token) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const at = modalStack.lastIndexOf(token);
      if (at !== -1) modalStack.splice(at, 1);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-4 pt-16 sm:pt-24"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full rounded-xl border border-hairline bg-surface-1 p-5 shadow-2xl shadow-black/40 ${
          width === 'lg' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * The "there is nothing here yet" panel, on every page.
 *
 * The icon is optional on purpose. A page-level empty — the whole of Plan, the
 * whole of Portfolio — is the first thing a new ledger shows, and a bare line of
 * grey text there reads as a page that failed to load rather than one waiting
 * for you. A chart with two months of history missing is a different situation:
 * it sits inside a titled card that already says what it is, and stamping an
 * icon on it would be decoration competing with the eleven panels around it.
 *
 * `action` duplicates the quiet `+ Add …` in the card header on purpose. That
 * header control is a ghost button in muted grey, deliberately, because on a
 * card with fifteen rows of data it must not compete with them — but on a card
 * with no rows at all there is nothing to compete with, and the page ends up
 * with no lit control anywhere and nothing saying which way is forward.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      {icon && (
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20 [&>svg]:h-5.5 [&>svg]:w-5.5">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-prose text-sm text-ink-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {action && (
            <Button type="button" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button type="button" variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Something was meant to load and didn't — a price service, an embed.
 *
 * Separate from EmptyState because the two mean opposite things: empty is a
 * ledger with nothing in it yet, which is normal and often the user's next
 * move, while this is a failure they did not cause and usually cannot fix
 * beyond trying again. It carries the icon rather than relying on red text,
 * since colour alone is not a signal everyone receives.
 */
export function ErrorState({
  message,
  detail,
  onRetry,
  retryLabel = 'Try again',
  compact = false,
}: {
  message: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-xl border border-critical/25 bg-critical/8 ${compact ? 'px-3 py-2.5' : 'p-4'}`}
    >
      <IconWarning className="h-4.5 w-4.5 shrink-0 text-critical-text" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-critical-text">{message}</p>
        {detail && <p className="mt-0.5 text-xs text-ink-muted">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
