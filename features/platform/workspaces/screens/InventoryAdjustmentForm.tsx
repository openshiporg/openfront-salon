'use client';

import { useEffect, useState } from 'react';
import { adjustSavedInventoryIntent } from '../actions/workspaces';
import { parseInventoryIntent, submitInventoryIntent, releaseAcknowledgedIntent, type InventoryIntent, type InventoryAcknowledgement } from '../lib/inventoryIntent';

type Props = { actorId: string; productId: string; locations: { id: string; name: string }[]; allowNew: boolean };
export function InventoryAdjustmentForm({ actorId, productId, locations, allowNew }: Props) {
  const key = `salon:inventory-intent:v1:${actorId}:${productId}`;
  const [saved, setSaved] = useState<InventoryIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [inputError, setInputError] = useState('');
  const [result, setResult] = useState<InventoryAcknowledgement | null>(null);
  useEffect(() => {
    setReady(false); setSaved(null); setResult(null); setBlocked(false);
    try {
      const bytes = localStorage.getItem(key);
      if (bytes !== null) {
        const owned = parseInventoryIntent(JSON.parse(bytes), actorId, productId);
        if (!owned) setBlocked(true); else setSaved(owned);
      }
    } catch { setBlocked(true); }
    setReady(true);
  }, [key, actorId, productId]);
  if (!actorId) return <p role="alert" className="text-xs">We couldn't confirm your account. Reload the page and try again.</p>;
  if (!ready) return <p role="status" className="text-xs">Loading…</p>;
  if (blocked) return <p role="alert" className="text-xs">This browser can't save pending stock adjustments. Enable site storage and reload.</p>;
  if (!saved && !allowNew) return <p className="text-xs">This product can't take new adjustments.</p>;
  async function submit(form: FormData) {
    if (busy) return;
    setInputError('');
    let intent = saved;
    if (!intent) {
      try {
        intent = parseInventoryIntent({ version: 1, actorId, productId, locationId: form.get('locationId'), delta: Number(form.get('delta')), reason: form.get('reason')?.toString().trim(), idempotencyKey: `inventory:${crypto.randomUUID()}` }, actorId, productId);
      } catch { setInputError('This browser can\'t record adjustments. Try another browser.'); return; }
      if (!intent) { setInputError('Choose a location, a whole-number change other than zero, and a reason.'); return; }
    }
    setBusy(true); setResult(null);
    try {
      const owned = intent;
      const outcome = await submitInventoryIntent(localStorage, key, owned, adjustSavedInventoryIntent, () => {
        setSaved(owned); window.dispatchEvent(new Event('salon:inventory-intent-updated'));
      });
      if (outcome.status === 'storage-unverified') setBlocked(true); else setResult(outcome);
    } catch { setBlocked(true); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-2 text-xs" aria-label="Stock adjustment">
    {saved && <p>Pending: {saved.delta > 0 ? '+' : ''}{saved.delta} units{locations.find(location => location.id === saved.locationId) ? ` at ${locations.find(location => location.id === saved.locationId)!.name}` : ''}. Reason: {saved.reason}.</p>}
    {result?.status === 'acknowledged' ? <p role="status">Stock updated. New balance: {result.balanceAfter}.</p> : <>
      {inputError && <p role="alert">{inputError}</p>}
      <form action={submit} className="grid grid-cols-2 gap-2">
        {!saved && <>
          <label className="col-span-2">Stock location<select name="locationId" required className="mt-1 h-9 w-full border bg-background px-2 text-sm">{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label>Quantity change<input name="delta" type="number" step="1" required min={-1000000} max={1000000} className="mt-1 h-9 w-full border bg-background px-2 text-sm" /></label>
          <label>Reason<input name="reason" required maxLength={500} className="mt-1 h-9 w-full border bg-background px-2 text-sm" /></label>
        </>}
        <button disabled={busy || (!saved && locations.length === 0)} className="col-span-2 bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50">{busy ? 'Saving…' : saved ? 'Retry adjustment' : 'Record adjustment'}</button>
      </form>
      {result?.status === 'unverified' && <p role="alert">We couldn't confirm this adjustment. Retry it; it won't be applied twice.</p>}
    </>}
    {result?.status === 'acknowledged' && <button className="border p-2" onClick={() => {
      // Only an acknowledged, exact owned record may release the local slot.
      try {
        if (!saved || !releaseAcknowledgedIntent(localStorage, key, saved, result)) { setBlocked(true); return; }
        setSaved(null); setResult(null); window.dispatchEvent(new Event('salon:inventory-intent-updated'));
      } catch { setBlocked(true); }
    }}>{allowNew ? 'New adjustment' : 'Dismiss'}</button>}
  </section>;
}
