import { useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type MouseEvent, type ReactNode, type SelectHTMLAttributes } from 'react';

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
      className={`spotlight relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-4 transition-colors duration-200 hover:border-neutral-700 ${className}`}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3">
      <h2 className="text-base font-semibold text-neutral-100">{children}</h2>
      {action}
    </div>
  );
}

export function SubsectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</p>;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants: Record<string, string> = {
    primary: 'bg-accent text-white hover:bg-accent-hover',
    secondary: 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
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
    <label className="mb-1 block text-xs font-medium text-neutral-500" {...props}>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-neutral-700 bg-surface-0 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-neutral-600 focus:border-accent ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-neutral-700 bg-surface-0 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent ${props.className ?? ''}`}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-800 text-neutral-300',
    good: 'bg-emerald-500/15 text-emerald-400',
    bad: 'bg-red-500/15 text-red-400',
    warn: 'bg-amber-500/15 text-amber-400',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-700 p-8 text-center">
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
    </div>
  );
}
