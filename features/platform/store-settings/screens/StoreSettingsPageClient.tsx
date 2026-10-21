'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LogoPicker } from '../components/LogoPicker';
import { savePlatformStoreSettings, type PlatformStoreSettings, type SaveStoreSettingsState, type StoreSettingsLocation } from '../actions/store-settings';

const initial: SaveStoreSettingsState = { status: 'idle', message: null };
function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={disabled || pending} className="min-h-11 gap-2"><Save className="size-4" />{pending ? 'Saving…' : 'Save storefront settings'}</Button>;
}

export function StoreSettingsPageClient({ initialSettings, locations }: { initialSettings: PlatformStoreSettings | null; locations: StoreSettingsLocation[] }) {
  const [state, action] = useActionState(savePlatformStoreSettings, initial);
  const configured = Boolean(initialSettings?.id && initialSettings.primaryLocation?.id);
  return <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">Storefront settings</h1>
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className={`size-2 rounded-full ${configured ? 'bg-emerald-600' : 'bg-amber-500'}`} />{configured ? 'Configured' : 'Not configured'}</span>
    </header>
    <form action={action} className="grid gap-6">
      <section className="grid gap-4 border bg-background p-5">
        <h2 className="font-semibold">Public identity</h2>
        <Label htmlFor="storefront-name">Storefront name</Label>
        <Input id="storefront-name" name="name" defaultValue={initialSettings?.name || ''} maxLength={120} required className="min-h-11" />
        <Label htmlFor="storefront-description">Description</Label>
        <Textarea id="storefront-description" name="description" defaultValue={initialSettings?.description || ''} maxLength={240} rows={3} />
      </section>
      <LogoPicker initialIcon={initialSettings?.logoIcon} initialColor={initialSettings?.logoColor} />
      <section className="grid gap-4 border bg-background p-5">
        <h2 className="font-semibold">Primary location</h2>
        <Label htmlFor="primary-location">Active location</Label>
        <select id="primary-location" name="primaryLocationId" defaultValue={initialSettings?.primaryLocation?.id || locations[0]?.id || ''} required className="min-h-11 w-full rounded-md border bg-background px-3">
          {!locations.length ? <option value="">No active location</option> : null}
          {locations.map(location => <option key={location.id} value={location.id}>{location.name} — {location.city}, {location.state}</option>)}
        </select>
      </section>
      {state.status !== 'idle' ? <p role={state.status === 'error' ? 'alert' : 'status'} className={`border p-3 text-sm ${state.status === 'error' ? 'text-destructive' : 'text-emerald-700'}`}>{state.message}</p> : null}
      <div className="flex justify-end"><Submit disabled={!locations.length} /></div>
    </form>
  </div>;
}
