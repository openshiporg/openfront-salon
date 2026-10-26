'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ExternalLink, Save } from 'lucide-react';
import { LogoPicker } from '../components/LogoPicker';
import { savePlatformStoreSettings, type PlatformStoreSettings, type SaveStoreSettingsState, type StoreSettingsLocation } from '../actions/store-settings';
import { fieldLabelClass, inputClass, pillClass, textareaClass, trackClass } from '../../components/pill';

const initial: SaveStoreSettingsState = { status: 'idle', message: null };
function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <div className={trackClass}><button type="submit" disabled={disabled || pending} className={pillClass('primary')}><Save />{pending ? 'Saving…' : 'Save storefront settings'}</button></div>;
}

export function StoreSettingsPageClient({ initialSettings, locations }: { initialSettings: PlatformStoreSettings | null; locations: StoreSettingsLocation[] }) {
  const [state, action] = useActionState(savePlatformStoreSettings, initial);
  const [name, setName] = useState(initialSettings?.name || '');
  const configured = Boolean(initialSettings?.id && initialSettings.primaryLocation?.id);
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 px-4 pt-5 pb-24 md:px-6 md:pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-[1.375rem]">Storefront settings</h1>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><span aria-hidden="true" className={`inline-block size-2 rounded-full outline-3 -outline-offset-1 ${configured ? 'bg-emerald-500 outline-emerald-100 dark:outline-emerald-900/50' : 'bg-amber-500 outline-amber-100 dark:outline-amber-900/50'}`} />{configured ? 'Published' : 'Not configured'}</span>
        </div>
        <div className={trackClass}><a href="/" target="_blank" rel="noreferrer" className={pillClass('raised')}>View storefront<ExternalLink /></a></div>
      </header>
      <form action={action} className="grid gap-5">
        <section className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
          <h2 className="flex min-h-10 items-center border-b bg-muted/30 px-4 py-1.5 text-[13px] font-semibold">Public identity</h2>
          <div className="grid gap-4 p-4">
          <label htmlFor="storefront-name" className={fieldLabelClass}>Storefront name · header, footer, page titles<input id="storefront-name" name="name" value={name} onChange={event => setName(event.target.value)} maxLength={120} required className={inputClass} /></label>
          <label htmlFor="storefront-description" className={fieldLabelClass}>Description<textarea id="storefront-description" name="description" defaultValue={initialSettings?.description || ''} maxLength={240} rows={3} className={textareaClass} /></label>
          </div>
        </section>
        <LogoPicker initialIcon={initialSettings?.logoIcon} initialColor={initialSettings?.logoColor} name={name} />
        <section className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
          <h2 className="flex min-h-10 items-center border-b bg-muted/30 px-4 py-1.5 text-[13px] font-semibold">Primary location</h2>
          <div className="grid gap-4 p-4">
          <label htmlFor="primary-location" className={fieldLabelClass}>Location shown · address, hours, booking
            <select id="primary-location" name="primaryLocationId" defaultValue={initialSettings?.primaryLocation?.id || locations[0]?.id || ''} required className={inputClass}>
              {!locations.length ? <option value="">No active location</option> : null}
              {locations.map(location => <option key={location.id} value={location.id}>{location.name} — {location.city}, {location.state}</option>)}
            </select>
          </label>
          </div>
        </section>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {state.status !== 'idle' ? <p role={state.status === 'error' ? 'alert' : 'status'} className={`text-sm ${state.status === 'error' ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400'}`}>{state.message}</p> : null}
          <Submit disabled={!locations.length} />
        </div>
      </form>
    </div>
  );
}
