import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageBreadcrumbs } from '@/features/dashboard/components/PageBreadcrumbs';
import { pillClass, trackClass, tableClass, tableWrapClass, tdClass, thClass } from './pill';

export { pillClass, trackClass, fieldLabelClass, inputClass, textareaClass, labelize, tableClass, tableWrapClass, tdClass, thClass } from './pill';

/*
 * Salon platform kit: the front desk's book. Every operator screen opens on
 * the work to do now, lists are dense tables with a real status column,
 * filters are underline tabs, and every list has an explicit empty and
 * failure state. Corners stay at 6px or less; nothing is pill-shaped.
 */

export type Tone = 'emerald' | 'amber' | 'blue' | 'violet' | 'rose' | 'zinc' | 'sky' | 'orange';

const dotTones: Record<Tone, string> = {
  emerald: 'bg-emerald-500 outline-emerald-100 dark:bg-emerald-400 dark:outline-emerald-900/50',
  amber: 'bg-amber-500 outline-amber-100 dark:bg-amber-400 dark:outline-amber-900/50',
  blue: 'bg-blue-500 outline-blue-100 dark:bg-blue-400 dark:outline-blue-900/50',
  violet: 'bg-violet-500 outline-violet-100 dark:bg-violet-400 dark:outline-violet-900/50',
  rose: 'bg-rose-500 outline-rose-100 dark:bg-rose-400 dark:outline-rose-900/50',
  zinc: 'bg-zinc-400 outline-zinc-100 dark:bg-zinc-500 dark:outline-zinc-800/60',
  sky: 'bg-sky-500 outline-sky-100 dark:bg-sky-400 dark:outline-sky-900/50',
  orange: 'bg-orange-500 outline-orange-100 dark:bg-orange-400 dark:outline-orange-900/50',
};

export const appointmentTone: Record<string, Tone> = {
  pending: 'amber', confirmed: 'emerald', in_progress: 'blue', completed: 'zinc', cancelled: 'rose', no_show: 'orange',
};
export const appointmentLabel: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In chair', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full outline-3 -outline-offset-1', dotTones[tone], className)} />;
}

/** A status label that reads on the title line: dot + text. */
export function TitleStatus({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground"><StatusDot tone={tone} />{children}</span>;
}

/** A row of related controls. */
export function Track({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <div role={label ? 'group' : undefined} aria-label={label} className={cn(trackClass, className)}>{children}</div>;
}

export function PillLink({ href, children, variant = 'raised', size }: { href: string; children: ReactNode; variant?: 'raised' | 'primary' | 'danger' | 'quiet'; size?: 'sm' | 'md' }) {
  return <Link href={href} className={pillClass(variant, size)}>{children}</Link>;
}

/** Filter tabs: flat underline tabs; the active tab carries a 2px rule. */
export function SegmentTabs({ label, tabs, active }: { label: string; active: string; tabs: Array<{ value: string; label: string; href: string; count?: number | null }> }) {
  return (
    <nav aria-label={label} className="-mx-4 relative overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <div className="flex min-w-max items-end gap-5 border-b">
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count !== null ? <span className={cn('text-xs tabular-nums', isActive ? 'text-foreground/70' : 'text-muted-foreground/80')}>{tab.count}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PlatformPage({ breadcrumbs, children, width = 'wide' }: { breadcrumbs: Array<{ type: 'link' | 'page'; label: string; href?: string }>; children: ReactNode; width?: 'wide' | 'narrow' }) {
  return (
    <section className="flex min-w-0 flex-col">
      <PageBreadcrumbs items={[{ type: 'link', label: 'Dashboard', href: '/' }, ...breadcrumbs]} />
      <div className={cn('mx-auto flex w-full min-w-0 flex-col gap-5 px-4 pt-5 pb-24 md:px-6 md:pt-6 md:pb-24', width === 'wide' ? 'max-w-7xl' : 'max-w-4xl')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, status, meta, actions }: { title: ReactNode; status?: ReactNode; meta?: ReactNode; actions?: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-xl font-semibold tracking-tight md:text-[1.375rem]">{title}</h1>
          {status}
        </div>
        {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

/** A one-line ledger of the counts that decide what to do next. */
export function MetricStrip({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone; href?: string }> }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-[6px] border bg-border sm:flex sm:flex-wrap" style={{ gap: 1 }}>
      {items.map((item, index) => {
        const span = items.length % 2 === 1 && index === items.length - 1 ? 'col-span-2 sm:col-span-1' : '';
        const body = <>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">{item.tone ? <StatusDot tone={item.tone} /> : null}{item.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">{item.value}</dd>
        </>;
        const cell = cn('min-w-0 bg-background px-4 py-2.5 sm:min-w-[8.5rem] sm:flex-1', span);
        return item.href
          ? <Link key={item.label} href={item.href} className={cn(cell, 'block transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>{body}</Link>
          : <div key={item.label} className={cell}>{body}</div>;
      })}
    </dl>
  );
}

export function Panel({ title, icon: Icon, actions, children, className, padded = true, id }: { title?: ReactNode; icon?: ComponentType<{ className?: string }>; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={cn('min-w-0 overflow-hidden rounded-[6px] border bg-background', className)}>
      {title ? (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-1.5">
          <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">{Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate text-sm font-medium">{children}</dd></div>;
}

export function Chip({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className="inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-[4px] border bg-muted/30 px-1.5 text-[11px] font-medium text-muted-foreground">{tone ? <StatusDot tone={tone} /> : null}{children}</span>;
}

export function EmptyState({ icon: Icon, title, action }: { icon: ComponentType<{ className?: string }>; title: string; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[6px] border border-dashed bg-background px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground"><Icon className="size-4 shrink-0" />{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ id, title, message, action }: { id: string; title: string; message: string; action: ReactNode }) {
  return (
    <section role="alert" aria-labelledby={id} className="rounded-[6px] border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 md:p-5">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold"><StatusDot tone="amber" />{title}</h2>
      <p className="mt-1.5 max-w-2xl text-sm opacity-90">{message}</p>
      <div className="mt-4">{action}</div>
    </section>
  );
}

export function Notice({ tone = 'amber', title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[6px] border bg-background px-4 py-2.5 text-sm">
      <StatusDot tone={tone} className="mt-1.5" />
      <div className="min-w-0"><div className="font-medium">{title}</div>{children ? <div className="mt-0.5 text-muted-foreground">{children}</div> : null}</div>
    </div>
  );
}

export function usd(cents?: number | null, options: { whole?: boolean } = {}) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: options.whole ? 0 : 2 }).format((cents || 0) / 100);
}

export function initials(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.slice(0, 2).map((part) => part[0]) : ['·']).join('').toUpperCase();
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground', className)}>{initials(name)}</span>;
}

/** Dense operator table. Columns are declared by the caller; rows are plain <tr>s using `tdClass`. */
export function DataTable({ label, head, children, className }: { label: string; head: Array<{ label: ReactNode; className?: string }>; children: ReactNode; className?: string }) {
  return (
    <div className={cn(tableWrapClass, className)}>
      <table className={tableClass} aria-label={label}>
        <thead>
          <tr>{head.map((column, index) => <th key={index} scope="col" className={cn(thClass, column.className)}>{column.label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => <td colSpan={colSpan} className={cn(tdClass, className)}>{children}</td>;

/** Status as a mark in a table cell: dot + label, never a coloured pill. */
export function StatusCell({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium"><StatusDot tone={tone} />{children}</span>;
}
