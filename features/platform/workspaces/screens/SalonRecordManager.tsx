'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Pencil, Plus, Save, X } from 'lucide-react';
import { pillClass, trackClass } from '../../components/pill';
import { saveSalonRecordFromWorkspace, type SalonManagementData, type SalonManagementKind, type SalonManagementOption, type SalonManagementRecord } from '../actions/workspaces';

type Row = SalonManagementRecord;
const titles: Record<SalonManagementKind, string> = {
  client: 'Clients', staff: 'Staff', location: 'Locations', resource: 'Booking resources',
  product: 'Retail products', service: 'Bookable services', category: 'Service categories',
};
const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Weekday = (typeof weekdays)[number];
function newOperationKey() {
  const secureId = globalThis.crypto?.randomUUID?.();
  return `salon-management:${secureId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
}
const defaultHours = Object.fromEntries(weekdays.map((day) => [day, day === 'sunday' ? { closed: true, open: null, close: null } : { closed: false, open: '09:00', close: '17:00' }]));

export function SalonRecordManager({ kind, data }: { kind: SalonManagementKind; data: SalonManagementData }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const records = data.records || [];

  return (
    <section aria-labelledby={`management-${kind}`} className="min-w-0 scroll-mt-20 overflow-hidden rounded-2xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id={`management-${kind}`} className="text-sm font-semibold">{titles[kind]}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{records.length}</span>
          </div>
        </div>
        <div className={trackClass}><button type="button" aria-expanded={adding} onClick={() => { setAdding((value) => !value); setEditing(null); }} className={pillClass(adding ? 'quiet' : 'primary', 'sm')}>
          {adding ? <X aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}{adding ? 'Close' : `Add ${kind === 'staff' ? 'staff member' : kind === 'resource' ? 'resource' : kind}`}
        </button></div>
      </div>

      {adding && <div className="border-b bg-muted/20 p-4 md:p-5"><RecordForm kind={kind} data={data} onDone={() => setAdding(false)} /></div>}

      {records.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">No {titles[kind].toLowerCase()} yet.</div>
      ) : (
        <div className="divide-y">
          {records.map((record) => {
            const label = record.user?.name || record.name || 'Unnamed record';
            const categoryLabel = typeof record.category === 'string' ? record.category : record.category?.name || '';
            const subtitle = record.user?.email || record.sku || record.slug || record.type || record.address || categoryLabel;
            const status = record.status || (record.isActive === false ? 'inactive' : 'active');
            const activeEdit = editing === record.id;
            return (
              <article key={record.id} className="min-w-0">
                <div className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <h3 className="min-w-0 truncate text-sm font-semibold">{label}</h3>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground"><span aria-hidden="true" className={`size-2 rounded-full outline-3 -outline-offset-1 ${status === 'active' ? 'bg-emerald-500 outline-emerald-100 dark:outline-emerald-900/50' : 'bg-amber-500 outline-amber-100 dark:outline-amber-900/50'}`} />{status.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {subtitle && <span className="max-w-full break-all">{subtitle}</span>}
                      {kind === 'product' && typeof record.price === 'number' && <span>${(record.price / 100).toFixed(2)}</span>}
                      {kind === 'service' && typeof record.baseDuration === 'number' && <span>{record.baseDuration} min · ${((record.price ?? record.basePrice ?? 0) / 100).toFixed(2)}</span>}
                      {kind === 'resource' && <span>Capacity {record.capacity}</span>}
                    </div>
                  </div>
                  <div className={trackClass}><button type="button" onClick={() => { setEditing(activeEdit ? null : record.id); setAdding(false); }} className={pillClass(activeEdit ? 'quiet' : 'raised', 'sm')} aria-expanded={activeEdit}>
                    {activeEdit ? <X aria-hidden="true" className="h-4 w-4" /> : <Pencil aria-hidden="true" className="h-4 w-4" />}{activeEdit ? 'Cancel' : 'Edit'}
                  </button></div>
                </div>
                {activeEdit && <div className="border-t bg-muted/20 p-4 md:p-5"><RecordForm kind={kind} data={data} record={record} onDone={() => setEditing(null)} /></div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecordForm({ kind, data, record, onDone }: { kind: SalonManagementKind; data: SalonManagementData; record?: Row; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const defaults = record?.hours && typeof record.hours === 'object' ? record.hours : defaultHours;

  async function submit(form: HTMLFormElement) {
    setBusy(true); setMessage(null);
    const keyField = form.elements.namedItem('idempotencyKey') as HTMLInputElement | null;
    if (keyField && !keyField.value) keyField.value = newOperationKey();
    try {
      const result = await saveSalonRecordFromWorkspace(new FormData(form));
      setBusy(false);
      if (!result.success) { setMessage({ ok: false, text: result.error || 'The record could not be saved.' }); return; }
      setMessage({ ok: true, text: record ? 'Record updated.' : 'Record created.' });
      router.refresh();
      if (!record) setFormVersion((value) => value + 1);
      else onDone();
    } catch {
      setBusy(false);
      setMessage({ ok: false, text: 'Couldn\'t save. Try again.' });
    }
  }

  return (
    <form key={formVersion} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid min-w-0 gap-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="recordId" value={record?.id || ''} />
      <input type="hidden" name="idempotencyKey" value="" />
      <Fields kind={kind} data={data} record={record} defaults={defaults} />
      {kind === 'client' && <p className="text-xs text-muted-foreground">Clients set their own password from the storefront.</p>}
      {message && <div role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-800' : 'text-destructive'}`}>{message.text}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <div className={trackClass}>
          <button type="button" onClick={onDone} disabled={busy} className={pillClass('quiet')}>Cancel</button>
          <button type="submit" disabled={busy} className={pillClass('primary')}>
            {busy ? <ChevronDown aria-hidden="true" className="animate-bounce" /> : <Save aria-hidden="true" />}{busy ? 'Saving…' : record ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Fields({ kind, data, record, defaults }: { kind: SalonManagementKind; data: SalonManagementData; record?: Row; defaults: Partial<Record<Weekday, { open?: string | null; close?: string | null; closed?: boolean }>> }) {
  const recordName = record?.user?.name || record?.name || '';
  const recordEmail = record?.user?.email || record?.email || '';
  const recordPhone = record?.user?.phone || record?.phone || '';
  const grid = 'grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3';
  const field = 'min-w-0 text-xs font-medium text-muted-foreground';
  const input = 'mt-1.5 h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted/40';
  const textarea = 'mt-1.5 min-h-24 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const select = 'mt-1.5 h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const textField = (name: string, label: string, value: string | null | undefined = '', required = false, type = 'text', readOnly = false) => <label key={name} className={field}>{label}<input className={input} name={name} type={type} defaultValue={value ?? ''} required={required} readOnly={readOnly} maxLength={name === 'description' ? 2000 : 200} /></label>;
  const numberField = (name: string, label: string, value: number | null | undefined, required = true, min = 0, max?: number) => <label key={name} className={field}>{label}<input className={input} name={name} type="number" inputMode="numeric" step="1" defaultValue={value ?? ''} required={required} min={min} max={max} /></label>;
  const selectField = (name: string, label: string, options: Array<{ value: string; label: string }>, value = '', required = false) => <label key={name} className={field}>{label}<select className={select} name={name} defaultValue={value} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const relationOptions = (items: SalonManagementOption[]) => items.map((item) => {
    const inactive = item.isActive === false || item.status === 'inactive' || item.status === 'on_leave';
    return { value: item.id, label: `${item.user?.name || item.name || item.id}${inactive ? ' · inactive' : ''}` };
  });
  const multiSelect = (name: string, label: string, items: SalonManagementOption[], selected: Array<{ id: string }> = []) => <label key={name} className={`${field} sm:col-span-2 xl:col-span-1`}>{label}<select className="mt-1.5 min-h-28 w-full rounded-xl border bg-background px-2 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" name={name} multiple defaultValue={selected.map((item) => item.id)}>{relationOptions(items).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-1 block font-normal">Ctrl/⌘ to select multiple</span></label>;
  const activeCheckbox = (key: 'isActive' | 'isVisible', label: string, checked = true) => <label key={key} className="flex min-h-10 items-center gap-2 self-end rounded-xl border bg-background px-3 text-sm text-foreground sm:col-span-2 xl:col-span-1"><input type="hidden" name={`${key}Present`} value="true" /><input type="checkbox" name={key} value="true" defaultChecked={checked} className="h-4 w-4 accent-foreground" />{label}</label>;

  if (kind === 'client') return <div className={grid}>{textField('name', 'Full name', recordName, true)}{textField('email', 'Email', recordEmail, true, 'email', !!record)}{textField('phone', 'Phone', recordPhone)}{selectField('homeLocationId', 'Home location', relationOptions(data.locations), record?.homeLocation?.id || '')}</div>;
  if (kind === 'staff') return <div className={grid}>{textField('name', 'Full name', recordName, true)}{textField('email', 'Email', recordEmail, true, 'email', !!record)}{textField('phone', 'Phone', recordPhone)}{multiSelect('locationIds', 'Assigned locations', data.locations, record?.locations || [])}{selectField('role', 'Role', ['stylist', 'colorist', 'nail_tech', 'esthetician', 'massage_therapist', 'manager', 'receptionist'].map((value) => ({ value, label: value.replaceAll('_', ' ') })), record?.role || 'stylist', true)}{selectField('tier', 'Experience tier', ['junior', 'senior', 'master', 'celebrity'].map((value) => ({ value, label: value })), record?.tier || 'junior', true)}{selectField('status', 'Availability status', ['active', 'on_leave', 'inactive'].map((value) => ({ value, label: value.replaceAll('_', ' ') })), record?.status || 'active', true)}{multiSelect('serviceIds', 'Specialties', data.services, record?.specializations || [])}{data.canManageCompensation && <label className={field}>Base commission rate<input className={input} name="baseCommissionRate" type="number" inputMode="decimal" step="0.001" min="0" max="1" defaultValue={record?.baseCommissionRate ?? ''} /><span className="mt-1 block font-normal">0–1 · blank keeps current</span></label>}</div>;
  if (kind === 'location') return <><div className={grid}>{textField('name', 'Location name', record?.name, true)}{textField('address', 'Street address', record?.address, true)}{textField('city', 'City', record?.city, true)}{textField('state', 'State / region', record?.state, true)}{textField('zipCode', 'Postal code', record?.zipCode, true)}{textField('phone', 'Phone', record?.phone)}{textField('email', 'Email', record?.email, false, 'email')}{textField('timezone', 'IANA timezone', record?.timezone || 'America/New_York', true)}{activeCheckbox('isActive', 'Available for appointments', record?.isActive !== false)}</div><fieldset className="min-w-0 rounded-xl border p-3"><legend className="px-1 text-xs font-semibold">Weekly opening hours</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{weekdays.map((day) => { const hours = defaults?.[day] || { closed: true }; return <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border bg-background p-2"><span className="text-xs font-medium capitalize">{day}</span><label className="flex items-center gap-1 text-xs"><input type="checkbox" name={`hours.${day}.closed`} value="true" defaultChecked={hours.closed} onChange={(event) => { const closed = event.currentTarget.checked; const fields = event.currentTarget.closest('div')?.querySelectorAll<HTMLInputElement>('input[type="time"]'); fields?.forEach((input) => { input.disabled = closed; }); }} />Closed</label><input aria-label={`${day} opens`} className="h-9 min-w-0 rounded-md border px-2 text-sm" name={`hours.${day}.open`} type="time" defaultValue={hours.open || ''} disabled={hours.closed} /><input aria-label={`${day} closes`} className="h-9 min-w-0 rounded-md border px-2 text-sm" name={`hours.${day}.close`} type="time" defaultValue={hours.close || ''} disabled={hours.closed} /></div>; })}</div></fieldset></>;
  if (kind === 'resource') return <div className={grid}>{textField('name', 'Resource name', record?.name, true)}{selectField('type', 'Type', ['station', 'room', 'shampoo_bowl', 'equipment', 'color_bar', 'other'].map((value) => ({ value, label: value.replaceAll('_', ' ') })), record?.type || 'station', true)}{numberField('capacity', 'Simultaneous capacity', record?.capacity ?? 1, true, 1, 100)}{selectField('locationId', 'Location', relationOptions(data.locations.filter((item) => item.isActive !== false)), record?.location?.id || '', true)}{activeCheckbox('isActive', 'Available for booking', record?.isActive !== false)}</div>;
  if (kind === 'product') return <div className={grid}>{textField('name', 'Product name', record?.name, true)}{textField('sku', 'SKU', record?.sku, true)}{numberField('price', 'Retail price (cents)', record?.price, true, 0)}{numberField('cost', 'Unit cost (cents)', record?.cost ?? 0)}{numberField('reorderPoint', 'Aggregate reorder alert quantity', record?.reorderPoint ?? 5)}{textField('category', 'Category', typeof record?.category === 'string' ? record.category : '')}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label>{activeCheckbox('isActive', 'Available for sale', record?.isActive !== false)}</div>;
  if (kind === 'service') return <div className={grid}>{textField('name', 'Service name', record?.name, true)}{numberField('price', 'Price (cents)', record?.price ?? record?.basePrice, true, 0)}{numberField('baseDuration', 'Duration (minutes)', record?.baseDuration, true, 1, 480)}{selectField('status', 'Catalog status', ['active', 'inactive'].map((value) => ({ value, label: value })), record?.status || 'active', true)}{selectField('categoryId', 'Category', relationOptions(data.categories), typeof record?.category === 'object' && record.category ? record.category.id : '')}{multiSelect('specialistIds', 'Active specialists', data.stylists, record?.specialists || [])}{multiSelect('resourceIds', 'Required resources', data.resources, record?.requiredResources || [])}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label></div>;
  return <div className={grid}>{textField('name', 'Category name', record?.name, true)}{textField('slug', 'Slug', record?.slug)}{numberField('displayOrder', 'Display order', record?.displayOrder ?? record?.sortOrder ?? 0)}{activeCheckbox('isVisible', 'Visible in the client catalog', record?.isVisible !== false)}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label></div>;
}
