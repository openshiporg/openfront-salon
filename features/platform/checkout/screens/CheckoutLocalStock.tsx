import Link from 'next/link';
import { getCheckoutLocalStock, type CheckoutAppointment } from '../actions/checkout';

export async function CheckoutLocalStock({ appointment, page, search }: { appointment: CheckoutAppointment; page: number; search: string }) {
  const stock = await getCheckoutLocalStock(appointment, page * 30, search);
  if (!stock) return <p role="alert" className="rounded border border-amber-300 p-3 text-xs">Stock for this location couldn't be loaded. Reload to add retail items.</p>;
  const href = (next: number) => `/dashboard/platform/checkout/${appointment.id}?retailPage=${next}&retailSearch=${encodeURIComponent(search)}`;
  return <section aria-label="Appointment-location retail stock" className="rounded-xl border bg-background p-3">
    <h3 className="text-xs font-semibold uppercase tracking-wide">Retail at {stock.location.name}</h3>
    <p className="my-2 text-xs text-muted-foreground">In stock at this location. Changing pages clears unsaved quantities.</p>
    {stock.products.length === 0 ? <p className="text-xs">No active products match this page/search.</p> : <div className="grid gap-2">{stock.products.map(product => <div key={product.id} className="grid grid-cols-[1fr_72px] items-center gap-2 text-sm">
      <div className="min-w-0"><span className="block truncate font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price / 100)} · {product.localQuantity} local units</span></div>
      {product.localQuantity > 0 ? <><input type="hidden" name="retailProductId" value={product.id} /><input aria-label={`${product.name} requested local quantity`} name="retailQuantity" type="number" step="1" min="0" max={Math.min(1000, product.localQuantity)} defaultValue="0" className="h-8 rounded-md border bg-background px-2 text-xs" /></> : <span className="text-xs text-muted-foreground">No local stock</span>}
    </div>)}</div>}
    <nav aria-label="Retail product pages" className="mt-3 flex justify-between text-xs">{page > 0 ? <Link className="underline" href={href(page - 1)}>Previous</Link> : <span />}{stock.hasMore ? <Link className="underline" href={href(page + 1)}>Next</Link> : null}</nav>
  </section>;
}
