import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type MouseEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { IconWarning } from './icons';
import { browserDateOrderDiffers, formatDateNumeric } from '../../lib/core/format';

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
  default: 'card-material bg-surface-1 border-hairline hover:border-border',
  // Quiet panels stay flat deliberately: the level exists to let supporting
  // detail recede into the page, and giving it an edge and a shadow would be
  // undoing the one thing it is for.
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

/**
 * A panel's header, with the accent tick that marks the start of every one.
 *
 * The tick is the app's one repeated ornament, and it is doing a job rather
 * than decorating: on a screen of a dozen stacked panels the rules under the
 * titles all looked alike, so nothing said where a panel began — only where
 * its header ended. A lit mark at the left edge of each title gives the eye a
 * fixed point to run down the page against.
 */
export function TitleTick({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`w-0.5 shrink-0 rounded-full bg-accent ${className}`} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-hairline pb-3">
      <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-ink">
        <TitleTick className="h-3.5" />
        <span className="truncate">{children}</span>
      </h2>
      {action}
    </div>
  );
}

export function SubsectionLabel({ children }: { children: ReactNode }) {
  return <p className="t-label mb-3">{children}</p>;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  // Each variant carries its own hairline so the four sit at the same size and
  // a row of mixed buttons keeps one baseline — a bordered button next to an
  // unbordered one is 2px taller, which is visible and reads as a mistake.
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover',
    secondary: 'bg-surface-2 text-ink border-border hover:bg-border hover:border-ink-muted',
    danger: 'bg-critical text-white border-critical hover:brightness-110',
    ghost: 'border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink hover:border-hairline',
  };
  return (
    <button
      className={`font-display cursor-pointer rounded-md border px-3 py-1.5 text-sm font-semibold tracking-tight transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${variants[variant]} ${className}`}
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

/**
 * A date field that says which date it holds when the browser would disagree.
 *
 * The native control is kept — it is the right one, and on a phone it is the
 * only one that opens a real picker — but the browser draws its value in the
 * browser's locale, which `format.ts` documents as unchangeable from the page.
 * When that order differs from the app's, the field prints the date underneath
 * in the app's own format, so no screen ever shows two date orders without
 * saying which is which. On a browser that already agrees, nothing is added.
 */
export function DateInput({ value, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  // Read once per mount rather than per render: the browser's locale does not
  // change while a form is open, and the check allocates two formatters.
  const [ambiguous] = useState(browserDateOrderDiffers);
  const iso = typeof value === 'string' ? value : '';

  return (
    <>
      <DateInput {...props} value={value} />
      {ambiguous && iso && (
        <p className="t-caption mt-1" aria-hidden="true">
          {formatDateNumeric(iso)}
        </p>
      )}
    </>
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
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
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
