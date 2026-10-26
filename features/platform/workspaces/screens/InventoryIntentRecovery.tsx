'use client';

import { useState, useSyncExternalStore } from 'react';
import { parseInventoryIntent } from '../lib/inventoryIntent';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';
import { pillClass, trackClass } from '../../components/pill';

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('salon:inventory-intent-updated', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('salon:inventory-intent-updated', listener);
  };
}
function storagePage(actorId: string, page: number): string {
  const products: string[] = []; let error = false;
  try {
    const prefix = `salon:inventory-intent:v1:${actorId}:`;
    const length = localStorage.length, start = page * 25, end = Math.min(start + 25, length);
    for (let index = start; index < end; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const productId = key.slice(prefix.length), bytes = localStorage.getItem(key);
      try {
        if (!bytes || !parseInventoryIntent(JSON.parse(bytes), actorId, productId)) { error = true; continue; }
        products.push(productId);
      } catch { error = true; }
    }
    return JSON.stringify({ products: [...new Set(products)], more: end < length, error });
  } catch { return JSON.stringify({ products: [], more: false, error: true }); }
}

/** Finite storage pages, native change events, no polling or catalog-sample dependency. */
export function InventoryIntentRecovery({ actorId }: { actorId: string }) {
  const [page, setPage] = useState(0);
  const snapshot = useSyncExternalStore(subscribe, () => storagePage(actorId, page), () => 'loading');
  const data: { products: string[]; more: boolean; error: boolean } | null = snapshot === 'loading' ? null : JSON.parse(snapshot);
  if (!actorId) return <p role="alert">We couldn't confirm your account. Reload the page and try again.</p>;
  // Nothing pending on the first page: no panel at all.
  if (!data || (page === 0 && !data.more && !data.error && data.products.length === 0)) return null;
  return <section aria-label="Pending stock adjustments" className="grid gap-3 rounded-[6px] border border-amber-300 bg-background p-4 text-sm dark:border-amber-900">
    <h2 className="text-sm font-semibold">Pending stock adjustments</h2>
    {!data ? <p role="status">Loading…</p> : <>
      {data.error && <p role="alert">Some pending adjustments couldn't be loaded. Reload the page and try again.</p>}
      {data.products.length === 0 && !data.error && <p className="text-muted-foreground">None</p>}
      {data.products.map(productId => <InventoryAdjustmentForm key={`${actorId}:${productId}`} actorId={actorId} productId={productId} locations={[]} allowNew={false} />)}
    </>}
    {page > 0 || data?.more ? <nav aria-label="Pending adjustment pages" className={`${trackClass} justify-self-start`}><button type="button" className={pillClass('quiet', 'sm')} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button type="button" className={pillClass('raised', 'sm')} disabled={!data?.more} onClick={() => setPage(page + 1)}>Next</button></nav> : null}
  </section>;
}
