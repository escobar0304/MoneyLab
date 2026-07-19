import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-neutral-900">{children}</h2>
      {action}
    </div>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants: Record<string, string> = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'text-neutral-600 hover:bg-neutral-100',
  };
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
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
      className={`w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-500 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-500 ${props.className ?? ''}`}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700',
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-red-50 text-red-700',
    warn: 'bg-amber-50 text-amber-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Close">
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
    <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
    </div>
  );
}
