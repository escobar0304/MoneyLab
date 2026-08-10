import { createPortal } from 'react-dom';
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type MouseEvent, type ReactNode, type SelectHTMLAttributes } from 'react';

/**
 * Every panel in the app, on every page — so the spotlight is a property of the
 * design system rather than a dashboard-only flourish.
 *
 * The pointer position is written straight to CSS custom properties instead of
 * React state: a mousemove handler that called setState would re-render the
 * card's entire subtree (charts included) on every pointer sample.
 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
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
      className={`spotlight relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-4 transition-colors duration-200 hover:border-border ${className}`}
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
    <label className="mb-1 block text-xs font-medium text-ink-muted" {...props}>
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
 * Rendered through a portal to document.body, deliberately.
 *
 * `position: fixed` resolves against the viewport only while no ancestor has a
 * transform. Any GSAP tween that leaves a transform behind — a page transition,
 * a card reveal — silently promotes that ancestor to the containing block, and
 * an intermediate `overflow: hidden` (every Card has one) then clips the modal
 * to a sliver. The portal takes the modal out of that subtree entirely, so it
 * cannot be re-broken by an animation added somewhere far away later.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-4 pt-16 sm:pt-24"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface-1 p-5 shadow-2xl shadow-black/40">
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

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
