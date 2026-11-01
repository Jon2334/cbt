/**
 * Komponen UI bersama untuk dashboard CBT (guru & admin).
 *
 * Semua halaman memakai komponen di sini supaya tampilan, jarak, warna, dan
 * perilaku tombol/status konsisten. Gaya dasar (warna `brand`, `.btn`, `.input`,
 * `.badge`) didefinisikan sekali di src/index.css.
 */
import { Link } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/* -------------------------------------------------------------------------- */
/* Utilitas                                                                   */
/* -------------------------------------------------------------------------- */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type IconType = ComponentType<{ size?: number | string; className?: string }>;

export type Tone =
  | 'brand'
  | 'slate'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'purple';

/** Warna latar lembut untuk ikon/kotak status. */
export const TONE_SOFT: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  blue: 'bg-sky-50 text-sky-700 ring-sky-100',
  purple: 'bg-violet-50 text-violet-700 ring-violet-100',
};

/** Warna lencana (badge) solid-lembut. */
export const TONE_BADGE: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  blue: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
  purple: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
};

/** Warna teks aksen untuk judul kecil di dalam kartu. */
export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand-600',
  slate: 'text-slate-600',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-sky-600',
  purple: 'text-violet-600',
};

/* -------------------------------------------------------------------------- */
/* Tombol                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: 'sm' | 'md' = 'md',
  extra?: string
): string {
  return cn('btn', VARIANT_CLASS[variant], size === 'sm' && 'btn-sm', extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: IconType;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 14 : 16} />
      )}
      {children}
    </button>
  );
}

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: IconType;
  className?: string;
  children: ReactNode;
}

/** Tautan yang tampil seperti tombol (untuk navigasi, bukan aksi). */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Kartu & judul halaman                                                      */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('card', className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  tone = 'brand',
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
              TONE_SOFT[tone]
            )}
            aria-hidden="true"
          >
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

/** Judul halaman dengan breadcrumb opsional + area aksi di kanan. */
export function PageHeader({
  title,
  description,
  icon: Icon,
  tone = 'brand',
  breadcrumb,
  actions,
}: {
  title: string;
  description?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="animate-fade-in-up mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {breadcrumb.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.to ? (
                  <Link to={c.to} className="hover:text-brand-600 hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-600">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1',
                TONE_SOFT[tone]
              )}
              aria-hidden="true"
            >
              <Icon size={22} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Status & umpan balik                                                       */
/* -------------------------------------------------------------------------- */

export function Badge({
  tone = 'slate',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: IconType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('badge', TONE_BADGE[tone], className)}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

const ALERT_CLASS: Record<Tone, string> = {
  brand: 'border-brand-200 bg-brand-50 text-brand-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
  blue: 'border-sky-200 bg-sky-50 text-sky-900',
  purple: 'border-violet-200 bg-violet-50 text-violet-800',
};

/** Kotak pesan (error, info, peringatan). */
export function Alert({
  tone = 'red',
  title,
  icon: Icon,
  onDismiss,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  icon?: IconType;
  onDismiss?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'red' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        ALERT_CLASS[tone],
        className
      )}
    >
      {Icon && <Icon size={18} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? 'mt-0.5' : undefined)}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-black/5"
          aria-label="Tutup pesan"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-slate-500"
      role="status"
      aria-live="polite"
    >
      <span className="spinner text-brand-600" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Kartu statistik ringkas untuk beranda/monitoring. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  to,
}: {
  label: string;
  value: ReactNode;
  icon: IconType;
  tone?: Tone;
  hint?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-lg ring-1',
            TONE_SOFT[tone]
          )}
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const base =
    'card card-pad block transition-shadow duration-150 hover:shadow-md focus-visible:shadow-md';

  return to ? (
    <Link to={to} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Keadaan kosong: selalu beri tahu langkah berikutnya, bukan hanya “kosong”. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  tips,
}: {
  icon?: IconType;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tips?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      {Icon && (
        <span
          className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-slate-200"
          aria-hidden="true"
        >
          <Icon size={24} />
        </span>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
      {tips && (
        <div className="mt-5 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 text-left">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Cara memulai
          </p>
          <div className="text-sm text-slate-600">{tips}</div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Kontrol form                                                               */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="hint-error">{error}</p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn('input', invalid && 'input-error', className)}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn('input', 'pr-9', invalid && 'input-error', className)}
    >
      {children}
    </select>
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn('input', invalid && 'input-error', className)}
    />
  );
}

/** Saklar on/off yang lebih mudah dipahami dibanding checkbox biasa. */
export function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'inline-block size-4 transform rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
          aria-hidden="true"
        />
      </button>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-slate-700">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabel                                                                      */
/* -------------------------------------------------------------------------- */

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-slate-200 bg-white', className)}>
      {children}
    </div>
  );
}

export function Th({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase',
        align === 'left' && 'text-left',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = 'left',
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-slate-700 align-top',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  );
}
