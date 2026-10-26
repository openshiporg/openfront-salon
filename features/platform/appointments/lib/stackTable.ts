/*
 * A dense operator table that collapses to stacked rows below `lg`.
 * At `lg` and up it is a real <table> (40px rows, hairline rules); below,
 * each <tr> becomes a small grid card inside one bordered list, so a phone
 * never scrolls the page sideways. Local to the appointments, checkout,
 * sales and clients slices; the shared kit stays untouched.
 */
export const stackWrapClass = 'relative min-w-0 overflow-x-auto rounded-[6px] border bg-background';
export const stackTableClass = 'block w-full border-collapse text-sm lg:table';
export const stackHeadClass = 'hidden lg:table-header-group';
export const stackBodyClass = 'block divide-y lg:table-row-group lg:divide-y-0';
export const stackRowClass = 'grid min-w-0 gap-x-3 gap-y-1.5 px-3 py-3 transition-colors hover:bg-muted/30 lg:table-row lg:p-0';
export const stackCellClass = 'block min-w-0 lg:table-cell lg:h-10 lg:border-b lg:px-3 lg:py-2 lg:align-middle lg:[tr:last-child>&]:border-b-0';
export const stackThClass = 'h-9 whitespace-nowrap border-b bg-muted/40 px-3 text-left align-middle text-xs font-medium text-muted-foreground';
