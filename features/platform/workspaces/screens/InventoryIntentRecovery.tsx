'use client';

import { useState, useSyncExternalStore } from 'react';
import { parseInventoryIntent } from '../lib/inventoryIntent';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';

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
  return <section aria-label="Pending stock adjustments" className="grid gap-3 border bg-background p-4">
    <h2 className="font-semibold">Pending stock adjustments</h2>
    {!data ? <p role="status">Loading…</p> : <>
      {data.error && <p role="alert">Some pending adjustments couldn't be loaded. Reload the page and try again.</p>}
      {data.products.length === 0 && !data.error && <p>No pending adjustments.</p>}
      {data.products.map(productId => <InventoryAdjustmentForm key={`${actorId}:${productId}`} actorId={actorId} productId={productId} locations={[]} allowNew={false} />)}
    </>}
    <nav aria-label="Pending adjustment pages" className="flex gap-3 text-xs"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button disabled={!data?.more} onClick={() => setPage(page + 1)}>Next</button></nav>
  </section>;
}
