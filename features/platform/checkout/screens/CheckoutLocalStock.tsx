import { getCheckoutLocalStock, type CheckoutAppointment } from '../actions/checkout';
import { PillLink, Track, usd } from '../../components/salon-ui';

export async function CheckoutLocalStock({ appointment, page, search }: { appointment: CheckoutAppointment; page: number; search: string }) {
  const stock = await getCheckoutLocalStock(appointment, page * 30, search);
  if (!stock) return <p role="alert" className="rounded-[6px] border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Stock for this location couldn&apos;t be loaded. Reload to add retail items.</p>;
  const href = (next: number) => `/dashboard/platform/checkout/${appointment.id}?retailPage=${next}&retailSearch=${encodeURIComponent(search)}`;
  return (
    <section aria-label="Appointment-location retail stock" className="overflow-hidden rounded-[6px] border bg-background">
      <div className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h4 className="text-xs font-semibold">Retail · {stock.location.name}</h4>
        <span className="text-[11px] text-muted-foreground">Changing pages clears quantities</span>
      </div>
      {stock.products.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No active products match.</p> : (
        <ul className="divide-y">
          {stock.products.map((product) => (
            <li key={product.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0"><span className="block truncate font-medium">{product.name}</span><span className="block text-xs tabular-nums text-muted-foreground">{usd(product.price)} · {product.localQuantity} on hand</span></div>
              {product.localQuantity > 0 ? <><input type="hidden" name="retailProductId" value={product.id} /><input aria-label={`${product.name} requested local quantity`} name="retailQuantity" type="number" step="1" min="0" max={Math.min(1000, product.localQuantity)} defaultValue="0" className="h-9 w-full rounded-[6px] border border-input bg-background px-2 text-right text-sm tabular-nums outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30" /></> : <span className="text-right text-xs text-muted-foreground">Out</span>}
            </li>
          ))}
        </ul>
      )}
      {page > 0 || stock.hasMore ? (
        <nav aria-label="Retail product pages" className="flex justify-end border-t p-2">
          <Track>
            {page > 0 ? <PillLink href={href(page - 1)} size="sm" variant="quiet">Previous</PillLink> : null}
            {stock.hasMore ? <PillLink href={href(page + 1)} size="sm">Next</PillLink> : null}
          </Track>
        </nav>
      ) : null}
    </section>
  );
}
