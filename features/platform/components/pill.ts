import { cn } from '@/lib/utils';

/*
 * Control classes for the salon platform. The names are kept from the earlier
 * pill kit so every screen keeps compiling; the shapes are now flat 6px
 * controls with no recessed track (owner rule, 2026-10-25: no pill or rounded
 * tabs, radii at most 6px).
 */

/** A plain row of controls. No recessed track. */
export const trackClass = 'inline-flex max-w-full flex-wrap items-center gap-1.5';

export function pillClass(variant: 'raised' | 'primary' | 'danger' | 'quiet' = 'raised', size: 'sm' | 'md' = 'md') {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
    size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
    variant === 'primary' && 'bg-foreground text-background hover:bg-foreground/85',
    variant === 'raised' && 'border border-border bg-background text-foreground hover:border-foreground/25 hover:bg-muted/60',
    variant === 'danger' && 'border border-rose-300 bg-background text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40',
    variant === 'quiet' && 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}

export const fieldLabelClass = 'grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground';
export const inputClass = 'h-9 w-full min-w-0 rounded-[6px] border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60';
export const textareaClass = 'min-h-24 w-full min-w-0 rounded-[6px] border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30';

/** Dense table parts, for lists an operator scans and acts on. */
export const tableWrapClass = 'min-w-0 overflow-x-auto rounded-[6px] border bg-background';
export const tableClass = 'w-full border-collapse text-sm';
export const thClass = 'h-9 whitespace-nowrap border-b bg-muted/40 px-3 text-left align-middle text-xs font-medium text-muted-foreground';
export const tdClass = 'border-b px-3 py-2.5 align-top [tr:last-child>&]:border-b-0';

/** Stored enum values to merchant labels: "nail_tech" → "Nail tech". */
export function labelize(value?: string | null) {
  const text = String(value || '').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
