'use client';

import { useState } from 'react';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';
import { fieldLabelClass, inputClass, pillClass, tableClass, tdClass, thClass } from '../../components/pill';

export type StockProduct = { id: string; name: string; sku?: string | null; onHand: number; reorderAt: number; low: boolean; canAdjust: boolean };

/**
 * Inventory's first view: what is low, and one place to record a stock change.
 * Choosing "Record" on a low row loads that product into the form.
 */
export function StockDesk({ actorId, products, locations }: { actorId: string; products: StockProduct[]; locations: { id: string; name: string }[] }) {
  const adjustable = products.filter((product) => product.canAdjust);
  const low = products.filter((product) => product.low);
  const [productId, setProductId] = useState((low.find((product) => product.canAdjust) || adjustable[0])?.id || '');
  const selected = adjustable.find((product) => product.id === productId);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <section aria-labelledby="low-stock" className="grid min-w-0 gap-2">
        <h2 id="low-stock" className="flex items-baseline gap-2 text-sm font-semibold">Low stock<span className="text-xs font-normal tabular-nums text-muted-foreground">{low.length}</span></h2>
        <div className="min-w-0 relative overflow-x-auto rounded-[6px] border bg-background">
          <table className={tableClass} aria-labelledby="low-stock">
            <thead><tr><th scope="col" className={thClass}>Product</th><th scope="col" className={`${thClass} text-right`}>On hand</th><th scope="col" className={`${thClass} text-right`}>Reorder at</th><th scope="col" className={`${thClass} w-px`}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {low.length === 0 ? <tr><td colSpan={4} className={`${tdClass} py-4 text-muted-foreground`}>Nothing at or below its reorder point.</td></tr> : low.map((product) => (
                <tr key={product.id} className={product.id === productId ? 'bg-muted/40' : undefined}>
                  <td className={tdClass}><span className="font-medium">{product.name}</span>{product.sku ? <span className="block font-mono text-xs text-muted-foreground">{product.sku}</span> : null}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-rose-700 dark:text-rose-400`}>{product.onHand}</td>
                  <td className={`${tdClass} text-right tabular-nums text-muted-foreground`}>{product.reorderAt}</td>
                  <td className={`${tdClass} text-right`}>{product.canAdjust ? <button type="button" aria-pressed={product.id === productId} onClick={() => setProductId(product.id)} className={pillClass(product.id === productId ? 'raised' : 'quiet', 'sm')}>Record</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="record-stock" className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
        <div className="flex min-h-10 items-center border-b bg-muted/30 px-4 py-1.5"><h2 id="record-stock" className="text-[13px] font-semibold">Record stock</h2></div>
        <div className="grid gap-3 p-4">
          {adjustable.length === 0 ? <p className="text-sm text-muted-foreground">No active products to adjust.</p> : (
            <>
              <label className={fieldLabelClass}>Product
                <select value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}>
                  {adjustable.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.onHand} on hand{product.low ? ' · low' : ''}</option>)}
                </select>
              </label>
              {selected ? <InventoryAdjustmentForm key={`${actorId}:${selected.id}`} actorId={actorId} productId={selected.id} allowNew locations={locations} /> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
