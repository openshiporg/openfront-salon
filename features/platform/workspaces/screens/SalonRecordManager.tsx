'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Save, X } from 'lucide-react';
import { inputClass, labelize, pillClass, tableClass, tableWrapClass, tdClass, thClass, trackClass } from '../../components/pill';
import { saveSalonRecordFromWorkspace, type SalonManagementData, type SalonManagementKind, type SalonManagementOption, type SalonManagementRecord } from '../actions/workspaces';

type Row = SalonManagementRecord;
const titles: Record<SalonManagementKind, string> = {
  client: 'Clients', staff: 'Staff', location: 'Locations', resource: 'Booking resources',
  product: 'Retail products', service: 'Bookable services', category: 'Service categories',
};
const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Weekday = (typeof weekdays)[number];
/** IANA zones from the runtime, with the stored value kept even if the runtime lacks it. */
function timeZoneOptions(current?: string | null) {
  let zones: string[] = [];
  try { zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') || []; } catch { zones = []; }
  if (!zones.length) zones = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'UTC'];
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

function newOperationKey() {
  const secureId = globalThis.crypto?.randomUUID?.();
  return `salon-management:${secureId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
}
const defaultHours = Object.fromEntries(weekdays.map((day) => [day, day === 'sunday' ? { closed: true, open: null, close: null } : { closed: false, open: '09:00', close: '17:00' }]));

/** Facts the operations workspace adds to a managed record (stock on hand, weekly hours, staff counts). */
export type RecordExtra = { value: string; tone?: 'emerald' | 'amber' | 'rose' | 'zinc'; status?: string };

const addLabels: Record<SalonManagementKind, string> = {
  client: 'Add client', staff: 'Add staff member', location: 'Add location', resource: 'Add resource',
  product: 'Add product', service: 'Add service', category: 'Add category',
};
const searchable: SalonManagementKind[] = ['client', 'product', 'service', 'staff'];
const toneDot: Record<NonNullable<RecordExtra['tone']>, string> = {
  emerald: 'bg-emerald-500 outline-emerald-100 dark:bg-emerald-400 dark:outline-emerald-900/50',
  amber: 'bg-amber-500 outline-amber-100 dark:bg-amber-400 dark:outline-amber-900/50',
  rose: 'bg-rose-500 outline-rose-100 dark:bg-rose-400 dark:outline-rose-900/50',
  zinc: 'bg-zinc-400 outline-zinc-100 dark:bg-zinc-500 dark:outline-zinc-800/60',
};

function Status({ tone, children }: { tone: NonNullable<RecordExtra['tone']>; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium"><span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full outline-3 -outline-offset-1 ${toneDot[tone]}`} />{children}</span>;
}

function money(cents?: number | null) {
  return typeof cents === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : '—';
}

type Column = { label: string; className?: string; cell: (record: Row) => ReactNode };

function columnsFor(kind: SalonManagementKind, data: SalonManagementData, extras: Record<string, RecordExtra>): Column[] {
  const nameOf = (items: SalonManagementOption[], id?: string | null) => { const item = items.find((option) => option.id === id); return item?.user?.name || item?.name || ''; };
  const muted = 'text-muted-foreground';
  const hideSm = 'hidden md:table-cell';
  const activeStatus = (record: Row, on = 'Active', off = 'Inactive') => record.isActive === false ? <Status tone="zinc">{off}</Status> : <Status tone="emerald">{on}</Status>;
  switch (kind) {
    case 'service': return [
      { label: 'Category', className: hideSm, cell: (record) => <span className={muted}>{nameOf(data.categories, typeof record.category === 'object' ? record.category?.id : null) || 'Uncategorized'}</span> },
      { label: 'Duration', className: 'text-right', cell: (record) => <span className="tabular-nums">{record.baseDuration ?? 0} min</span> },
      { label: 'Price', className: 'text-right', cell: (record) => <span className="tabular-nums">{money(record.price ?? record.basePrice)}</span> },
      { label: 'Buffer', className: `${hideSm} text-right`, cell: (record) => <span className={`tabular-nums ${muted}`}>{record.bufferMinutes ?? 0} min</span> },
      { label: 'Stylists', className: hideSm, cell: (record) => { const names = (record.specialists || []).map((item) => nameOf(data.stylists, item.id)).filter(Boolean); return names.length ? <span className={muted} title={names.join(', ')}>{names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')}</span> : <span className="text-amber-700 dark:text-amber-400">None</span>; } },
      { label: 'Online', cell: (record) => {
        const activeStylists = (record.specialists || []).filter((item) => { const stylist = data.stylists.find((option) => option.id === item.id); return stylist && stylist.isActive !== false && stylist.status !== 'inactive'; });
        if (record.status !== 'active') return <span className={muted}>No</span>;
        return activeStylists.length ? <span>Yes</span> : <span className="text-amber-700 dark:text-amber-400">No stylist</span>;
      } },
      { label: 'Status', cell: (record) => record.status === 'active' ? <Status tone="emerald">Active</Status> : <Status tone="zinc">{labelize(record.status) || 'Draft'}</Status> },
    ];
    case 'category': return [
      { label: 'Slug', className: hideSm, cell: (record) => <span className={muted}>{record.slug || '—'}</span> },
      { label: 'Order', className: 'text-right', cell: (record) => <span className="tabular-nums">{record.displayOrder ?? record.sortOrder ?? 0}</span> },
      { label: 'Status', cell: (record) => record.isVisible === false ? <Status tone="zinc">Hidden</Status> : <Status tone="emerald">Visible</Status> },
    ];
    case 'staff': return [
      { label: 'Role', cell: (record) => <span className="whitespace-nowrap">{[labelize(record.tier), labelize(record.role)?.toLowerCase()].filter(Boolean).join(' ') || '—'}</span> },
      { label: 'Locations', className: hideSm, cell: (record) => <span className={muted}>{(record.locations || []).map((item) => nameOf(data.locations, item.id)).filter(Boolean).join(', ') || <span className="text-amber-700 dark:text-amber-400">None</span>}</span> },
      { label: 'Weekly hours', className: hideSm, cell: (record) => { const extra = extras[record.id]; return extra ? <span className={extra.tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : muted}>{extra.value}</span> : <span className={muted}>—</span>; } },
      { label: 'Status', cell: (record) => record.status === 'on_leave' ? <Status tone="amber">On leave</Status> : record.status === 'inactive' || record.isActive === false ? <Status tone="zinc">Inactive</Status> : <Status tone="emerald">Active</Status> },
    ];
    case 'location': return [
      { label: 'City', className: hideSm, cell: (record) => <span className={muted}>{[record.city, record.state].filter(Boolean).join(', ') || '—'}</span> },
      { label: 'Time zone', className: hideSm, cell: (record) => <span className={muted}>{record.timezone?.replaceAll('_', ' ') || '—'}</span> },
      { label: 'Staff · resources', cell: (record) => <span className={`whitespace-nowrap ${muted}`}>{extras[record.id]?.value || '—'}</span> },
      { label: 'Status', cell: (record) => activeStatus(record) },
    ];
    case 'resource': return [
      { label: 'Type', cell: (record) => <span>{labelize(record.type) || '—'}</span> },
      { label: 'Location', className: hideSm, cell: (record) => <span className={muted}>{nameOf(data.locations, record.location?.id) || '—'}</span> },
      { label: 'Capacity', className: 'text-right', cell: (record) => <span className="tabular-nums">{record.capacity ?? 1}</span> },
      { label: 'Status', cell: (record) => activeStatus(record, 'Bookable') },
    ];
    case 'product': return [
      { label: 'SKU', className: hideSm, cell: (record) => <span className={`font-mono text-xs ${muted}`}>{record.sku || '—'}</span> },
      { label: 'Price', className: 'text-right', cell: (record) => <span className="tabular-nums">{money(record.price)}</span> },
      { label: 'On hand', className: 'text-right', cell: (record) => <span className={`tabular-nums ${extras[record.id]?.tone === 'rose' ? 'font-semibold text-rose-700 dark:text-rose-400' : ''}`}>{extras[record.id]?.value ?? '—'}</span> },
      { label: 'Reorder at', className: `${hideSm} text-right`, cell: (record) => <span className={`tabular-nums ${muted}`}>{record.reorderPoint ?? 0}</span> },
      { label: 'Status', cell: (record) => record.isActive === false ? <Status tone="zinc">Inactive</Status> : extras[record.id]?.tone === 'rose' ? <Status tone="rose">Reorder</Status> : <Status tone="emerald">In stock</Status> },
    ];
    default: return [
      { label: 'Email', className: hideSm, cell: (record) => <span className={`break-all ${muted}`}>{record.user?.email || record.guestEmail || '—'}</span> },
      { label: 'Phone', className: hideSm, cell: (record) => <span className={`whitespace-nowrap ${muted}`}>{record.user?.phone || record.guestPhone || '—'}</span> },
      { label: 'Account', cell: (record) => record.user ? <Status tone="emerald">Account</Status> : <Status tone="zinc">Guest</Status> },
    ];
  }
}

function detailHref(kind: SalonManagementKind, id: string) {
  if (kind === 'client') return `/dashboard/platform/clients/${id}`;
  if (kind === 'service') return `/dashboard/platform/catalog/${id}`;
  if (kind === 'staff') return `/dashboard/platform/staff/${id}`;
  return null;
}

function subline(kind: SalonManagementKind, record: Row) {
  if (kind === 'staff') return record.user?.email || '';
  if (kind === 'location') return record.address || '';
  if (kind === 'client') return '';
  return '';
}

export function SalonRecordManager({ kind, data, extras = {}, title }: { kind: SalonManagementKind; data: SalonManagementData; extras?: Record<string, RecordExtra>; title?: string }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const all = data.records || [];
  const records = all.filter((record) => !needle || [record.user?.name, record.user?.email, record.user?.phone, record.name, record.guestName, record.guestEmail, record.guestPhone, record.sku].some((value) => value?.toLowerCase().includes(needle)));
  const allColumns = columnsFor(kind, data, extras);
  // Below md the status sits second, straight after the name, so a phone never scrolls to find it.
  const statusColumn = allColumns.find((column) => column.label === 'Status') || null;
  const columns = allColumns.map((column) => column === statusColumn ? { ...column, className: `${column.className || ''} hidden md:table-cell` } : column);
  const span = columns.length + 2 + (statusColumn ? 1 : 0);

  return (
    <section aria-labelledby={`management-${kind}-title`} id={`management-${kind}`} className="grid min-w-0 scroll-mt-20 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`management-${kind}-title`} className="flex items-baseline gap-2 text-sm font-semibold">{title || titles[kind]}<span className="text-xs font-normal tabular-nums text-muted-foreground">{all.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          {searchable.includes(kind) && all.length > 5 ? (
            <label className="w-full sm:w-64"><span className="sr-only">Search {(title || titles[kind]).toLowerCase()}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === 'client' ? 'Search name, email or phone' : kind === 'product' ? 'Search name or SKU' : 'Search'} className={`${inputClass} h-8`} /></label>
          ) : null}
          <button type="button" aria-expanded={adding} onClick={() => { setAdding((value) => !value); setEditing(null); }} className={pillClass(adding ? 'quiet' : 'raised', 'sm')}>
            {adding ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}{adding ? 'Close' : addLabels[kind]}
          </button>
        </div>
      </div>

      {adding && <div className="rounded-[6px] border bg-muted/20 p-4"><RecordForm kind={kind} data={data} onDone={() => setAdding(false)} /></div>}

      <div className={tableWrapClass}>
        <table className={tableClass} aria-labelledby={`management-${kind}-title`}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>{kind === 'staff' ? 'Name' : kind === 'client' ? 'Client' : labelize(kind)}</th>
              {statusColumn ? <th scope="col" className={`${thClass} md:hidden`}>Status</th> : null}
              {columns.map((column) => <th key={column.label} scope="col" className={`${thClass} ${column.className || ''}`}>{column.label}</th>)}
              <th scope="col" className={`${thClass} w-px`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={span} className={`${tdClass} py-6 text-center text-muted-foreground`}>{needle ? 'No matches.' : `No ${(title || titles[kind]).toLowerCase()} yet.`}</td></tr>
            ) : records.map((record) => {
              const label = record.user?.name || record.name || record.guestName || 'Unnamed record';
              const href = detailHref(kind, record.id);
              const sub = subline(kind, record);
              const activeEdit = editing === record.id;
              return (
                <Fragment key={record.id}>
                  <tr className={activeEdit ? 'bg-muted/30' : 'hover:bg-muted/20'}>
                    <td className={`${tdClass} min-w-[10rem]`}>
                      {href ? <a href={href} className="font-medium underline-offset-4 hover:underline">{label}</a> : <span className="font-medium">{label}</span>}
                      {sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}
                    </td>
                    {statusColumn ? <td className={`${tdClass} md:hidden`}>{statusColumn.cell(record)}</td> : null}
                    {columns.map((column) => <td key={column.label} className={`${tdClass} ${column.className || ''}`}>{column.cell(record)}</td>)}
                    <td className={`${tdClass} text-right`}>
                      <button type="button" onClick={() => { setEditing(activeEdit ? null : record.id); setAdding(false); }} className={pillClass('quiet', 'sm')} aria-expanded={activeEdit} aria-label={`${activeEdit ? 'Cancel editing' : 'Edit'} ${label}`}>
                        {activeEdit ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}{activeEdit ? 'Cancel' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  {activeEdit ? <tr><td colSpan={span} className="border-b bg-muted/20 p-4"><RecordForm kind={kind} data={data} record={record} onDone={() => setEditing(null)} /></td></tr> : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
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
      const formData = new FormData(form);
      // Merchants enter dollars and percents; the workflow stores cents and 0–1 rates.
      form.querySelectorAll<HTMLInputElement>('input[data-money]').forEach((input) => { if (input.value.trim() !== '') formData.set(input.name, String(Math.round(Number(input.value) * 100))); });
      form.querySelectorAll<HTMLInputElement>('input[data-percent]').forEach((input) => { if (input.value.trim() !== '') formData.set(input.name, String(Number(input.value) / 100)); });
      const result = await saveSalonRecordFromWorkspace(formData);
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
      {message && <div role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{message.text}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <div className={trackClass}>
          <button type="button" onClick={onDone} disabled={busy} className={pillClass('quiet')}>Cancel</button>
          <button type="submit" disabled={busy} className={pillClass('primary')}>
            {busy ? null : <Save aria-hidden="true" />}{busy ? 'Saving…' : record ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Fields({ kind, data, record, defaults }: { kind: SalonManagementKind; data: SalonManagementData; record?: Row; defaults: Partial<Record<Weekday, { open?: string | null; close?: string | null; closed?: boolean }>> }) {
  const recordName = record?.user?.name || record?.name || record?.guestName || '';
  const recordEmail = record?.user?.email || record?.email || record?.guestEmail || '';
  const recordPhone = record?.user?.phone || record?.phone || record?.guestPhone || '';
  const grid = 'grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3';
  const field = 'min-w-0 text-xs font-medium text-muted-foreground';
  const control = 'w-full min-w-0 rounded-[6px] border border-input bg-background text-sm font-normal text-foreground outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30';
  const input = `${control} mt-1.5 h-9 px-2.5 read-only:bg-muted/40`;
  const textarea = `${control} mt-1.5 min-h-24 px-2.5 py-2`;
  const select = `${control} mt-1.5 h-9 px-2.5`;
  const textField = (name: string, label: string, value: string | null | undefined = '', required = false, type = 'text', readOnly = false) => <label key={name} className={field}>{label}<input className={input} name={name} type={type} defaultValue={value ?? ''} required={required} readOnly={readOnly} maxLength={name === 'description' ? 2000 : 200} /></label>;
  const numberField = (name: string, label: string, value: number | null | undefined, required = true, min = 0, max?: number) => <label key={name} className={field}>{label}<input className={input} name={name} type="number" inputMode="numeric" step="1" defaultValue={value ?? ''} required={required} min={min} max={max} /></label>;
  const moneyField = (name: string, label: string, cents: number | null | undefined, required = true) => <label key={name} className={field}>{label}<span className="relative mt-1.5 block"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><input className={`${input} !mt-0 pl-7`} name={name} type="number" inputMode="decimal" step="0.01" min="0" data-money="" defaultValue={cents === null || cents === undefined ? '' : (cents / 100).toFixed(2)} required={required} /></span></label>;
  const selectField = (name: string, label: string, options: Array<{ value: string; label: string }>, value = '', required = false) => <label key={name} className={field}>{label}<select className={select} name={name} defaultValue={value} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  const relationOptions = (items: SalonManagementOption[]) => items.map((item) => {
    const inactive = item.isActive === false || item.status === 'inactive' || item.status === 'on_leave';
    return { value: item.id, label: `${item.user?.name || item.name || item.id}${inactive ? ' · Inactive' : ''}` };
  });
  const multiSelect = (name: string, label: string, items: SalonManagementOption[], selected: Array<{ id: string }> = []) => <label key={name} className={`${field} sm:col-span-2 xl:col-span-1`}>{label}<select className={`${control} mt-1.5 min-h-28 px-2 py-2`} name={name} multiple defaultValue={selected.map((item) => item.id)}>{relationOptions(items).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-1 block font-normal">Ctrl/⌘ to select multiple</span></label>;
  const flagField = (key: string, label: string, checked: boolean) => <label key={key} className="flex min-h-9 items-center gap-2 self-end rounded-[6px] border bg-background px-2.5 text-sm text-foreground"><input type="checkbox" name={key} value="true" defaultChecked={checked} className="h-4 w-4 accent-foreground" />{label}</label>;
  const imageField = (name: string, label: string, current?: { imagePath?: string | null; image?: { url?: string | null } | null } | null) => {
    const src = current?.image?.url || current?.imagePath || '';
    return <label key={name} className={field}>{label}<span className="mt-1.5 flex min-w-0 items-center gap-3">{src ? <img src={src} alt="" className="size-10 shrink-0 rounded-[6px] border object-cover" /> : null}<input className="block w-full min-w-0 text-sm font-normal file:mr-3 file:rounded-[6px] file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium" name={name} type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></span></label>;
  };
  const activeCheckbox = (key: 'isActive' | 'isVisible', label: string, checked = true) => <label key={key} className="flex min-h-9 items-center gap-2 self-end rounded-[6px] border bg-background px-2.5 text-sm text-foreground sm:col-span-2 xl:col-span-1"><input type="hidden" name={`${key}Present`} value="true" /><input type="checkbox" name={key} value="true" defaultChecked={checked} className="h-4 w-4 accent-foreground" />{label}</label>;

  if (kind === 'client') return <div className={grid}>{textField('name', 'Full name', recordName, true)}{textField('email', 'Email', recordEmail, true, 'email', !!record)}{textField('phone', 'Phone', recordPhone)}{selectField('homeLocationId', 'Home location', relationOptions(data.locations), record?.homeLocation?.id || '')}</div>;
  if (kind === 'staff') return <div className={grid}>{textField('name', 'Full name', recordName, true)}{textField('email', 'Email', recordEmail, true, 'email', !!record)}{textField('phone', 'Phone', recordPhone)}{multiSelect('locationIds', 'Assigned locations', data.locations, record?.locations || [])}{selectField('role', 'Role', ['stylist', 'colorist', 'nail_tech', 'esthetician', 'massage_therapist', 'manager', 'receptionist'].map((value) => ({ value, label: labelize(value) })), record?.role || 'stylist', true)}{selectField('tier', 'Experience tier', ['junior', 'senior', 'master', 'celebrity'].map((value) => ({ value, label: labelize(value) })), record?.tier || 'junior', true)}{selectField('status', 'Availability status', ['active', 'on_leave', 'inactive'].map((value) => ({ value, label: labelize(value) })), record?.status || 'active', true)}{multiSelect('serviceIds', 'Specialties', data.services, record?.specializations || [])}<label className={`${field} sm:col-span-2 xl:col-span-2`}>Bio · shown on the storefront<textarea className={textarea} name="bio" defaultValue={record?.bio || ''} maxLength={2000} /></label>{imageField('photo', 'Photo', record?.photo)}{data.canManageCompensation && <label className={field}>Commission rate<span className="relative mt-1.5 block"><input className={`${input} !mt-0 pr-8`} name="baseCommissionRate" type="number" inputMode="decimal" step="0.1" min="0" max="100" data-percent="" defaultValue={typeof record?.baseCommissionRate === 'number' ? Number((record.baseCommissionRate * 100).toFixed(1)) : ''} /><span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></span></label>}</div>;
  if (kind === 'location') return <><div className={grid}>{textField('name', 'Location name', record?.name, true)}{textField('address', 'Street address', record?.address, true)}{textField('city', 'City', record?.city, true)}{textField('state', 'State / region', record?.state, true)}{textField('zipCode', 'Postal code', record?.zipCode, true)}{textField('phone', 'Phone', record?.phone)}{textField('email', 'Email', record?.email, false, 'email')}<label key="timezone" className={field}>Time zone<select className={select} name="timezone" defaultValue={record?.timezone || data.records.find((item: any) => item.timezone)?.timezone || 'America/Los_Angeles'} required>{timeZoneOptions(record?.timezone).map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></label>{activeCheckbox('isActive', 'Available for appointments', record?.isActive !== false)}</div><fieldset className="min-w-0 rounded-[6px] border p-3"><legend className="px-1 text-xs font-semibold">Weekly opening hours</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{weekdays.map((day) => { const hours = defaults?.[day] || { closed: true }; return <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[6px] border bg-background p-2"><span className="text-xs font-medium capitalize">{day}</span><label className="flex items-center gap-1 text-xs"><input type="checkbox" name={`hours.${day}.closed`} value="true" defaultChecked={hours.closed} onChange={(event) => { const closed = event.currentTarget.checked; const fields = event.currentTarget.closest('div')?.querySelectorAll<HTMLInputElement>('input[type="time"]'); fields?.forEach((input) => { input.disabled = closed; }); }} />Closed</label><input aria-label={`${day} opens`} className="h-9 min-w-0 rounded-[6px] border px-2 text-sm" name={`hours.${day}.open`} type="time" defaultValue={hours.open || ''} disabled={hours.closed} /><input aria-label={`${day} closes`} className="h-9 min-w-0 rounded-[6px] border px-2 text-sm" name={`hours.${day}.close`} type="time" defaultValue={hours.close || ''} disabled={hours.closed} /></div>; })}</div></fieldset></>;
  if (kind === 'resource') return <div className={grid}>{textField('name', 'Resource name', record?.name, true)}{selectField('type', 'Type', ['station', 'room', 'shampoo_bowl', 'equipment', 'color_bar', 'other'].map((value) => ({ value, label: labelize(value) })), record?.type || 'station', true)}{numberField('capacity', 'Simultaneous capacity', record?.capacity ?? 1, true, 1, 100)}{selectField('locationId', 'Location', relationOptions(data.locations.filter((item) => item.isActive !== false)), record?.location?.id || '', true)}{activeCheckbox('isActive', 'Available for booking', record?.isActive !== false)}</div>;
  if (kind === 'product') return <div className={grid}>{textField('name', 'Product name', record?.name, true)}{textField('sku', 'SKU', record?.sku, true)}{moneyField('price', 'Retail price', record?.price)}{moneyField('cost', 'Unit cost', record?.cost ?? 0)}{numberField('reorderPoint', 'Reorder at quantity', record?.reorderPoint ?? 5)}{textField('category', 'Category', typeof record?.category === 'string' ? record.category : '')}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label>{activeCheckbox('isActive', 'Available for sale', record?.isActive !== false)}</div>;
  if (kind === 'service') return <div className={grid}>{textField('name', 'Service name', record?.name, true)}{moneyField('price', 'Price', record?.price ?? record?.basePrice)}{numberField('baseDuration', 'Duration (minutes)', record?.baseDuration, true, 1, 480)}{numberField('bufferMinutes', 'Turnover after (minutes)', record?.bufferMinutes ?? 15, true, 0, 120)}{selectField('status', 'Catalog status', ['active', 'inactive'].map((value) => ({ value, label: labelize(value) })), record?.status || 'active', true)}{selectField('categoryId', 'Category', relationOptions(data.categories), typeof record?.category === 'object' && record.category ? record.category.id : '')}{multiSelect('specialistIds', 'Active specialists', data.stylists, record?.specialists || [])}{multiSelect('resourceIds', 'Required resources', data.resources, record?.requiredResources || [])}<input type="hidden" name="flagsPresent" value="true" />{flagField('depositRequired', 'Deposit required to book', Boolean(record?.depositRequired))}{moneyField('depositAmount', 'Deposit amount', record?.depositAmount ?? 0, false)}{flagField('requiresConsultation', 'Consultation before booking', Boolean(record?.requiresConsultation))}{flagField('requiresPatchTest', 'Patch test required', Boolean(record?.requiresPatchTest))}{imageField('image', 'Service image', record?.image)}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label></div>;
  return <div className={grid}>{textField('name', 'Category name', record?.name, true)}{textField('slug', 'Slug', record?.slug)}{numberField('displayOrder', 'Display order', record?.displayOrder ?? record?.sortOrder ?? 0)}{activeCheckbox('isVisible', 'Visible in the client catalog', record?.isVisible !== false)}<label className={`${field} sm:col-span-2 xl:col-span-3`}>Description<textarea className={textarea} name="description" defaultValue={record?.description || ''} maxLength={2000} /></label></div>;
}
