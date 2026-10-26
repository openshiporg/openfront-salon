'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CalendarPlus, Pencil, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';
import { saveSalonRecordFromWorkspace } from '../../workspaces/actions/workspaces';
import { stackBodyClass, stackCellClass, stackHeadClass, stackRowClass, stackTableClass, stackThClass, stackWrapClass } from '../../appointments/lib/stackTable';

export type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  account: boolean;
  homeLocationId: string;
  visits: number | null;
  lastVisit: string | null;
  next: { id: string; label: string } | null;
};

const digits = (value: string) => value.replace(/\D/g, '');

/** Search, table and add/edit for the client book. Filtering runs over the loaded list. */
export function ClientDirectory({ rows, visitsKnown, locations }: { rows: DirectoryRow[]; visitsKnown: boolean; locations: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const needle = query.trim().toLowerCase();
  const needleDigits = digits(query);
  const filtered = useMemo(() => (!needle ? rows : rows.filter((row) =>
    row.name.toLowerCase().includes(needle)
    || row.email.toLowerCase().includes(needle)
    || (needleDigits.length >= 3 && digits(row.phone).includes(needleDigits))
  )), [rows, needle, needleDigits]);

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-md">
          <span className="sr-only">Find a client</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a client by name, phone or email" className={cn(inputClass, 'pl-8')} />
        </label>
        <div className={trackClass}>
          <button type="button" aria-expanded={adding} onClick={() => { setAdding((value) => !value); setEditing(null); }} className={pillClass(adding ? 'quiet' : 'primary')}>
            {adding ? <X /> : <Plus />}{adding ? 'Close' : 'Add client'}
          </button>
        </div>
      </div>

      {adding ? (
        <section aria-label="Add client" className="rounded-[6px] border bg-background">
          <h2 className="flex min-h-10 items-center border-b bg-muted/30 px-4 text-[13px] font-semibold">New client</h2>
          <div className="p-4"><ClientRecordForm locations={locations} onDone={() => setAdding(false)} /></div>
        </section>
      ) : null}

      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {needle ? `${filtered.length} of ${rows.length} ${rows.length === 1 ? 'client' : 'clients'}` : `${rows.length} ${rows.length === 1 ? 'client' : 'clients'}${rows.length >= 100 ? ', newest 100 shown' : ''}`}
        {visitsKnown ? null : ' · visit history unavailable'}
      </p>

      {rows.length === 0 ? (
        <Empty>No clients yet{adding ? null : <button type="button" onClick={() => setAdding(true)} className={pillClass('raised', 'sm')}><Plus />Add client</button>}</Empty>
      ) : filtered.length === 0 ? (
        <Empty>No clients match “{query.trim()}”<button type="button" onClick={() => setQuery('')} className={pillClass('quiet', 'sm')}>Clear search</button><Link href={`/dashboard/platform/appointments/new?${/[a-z]/i.test(query) ? 'name' : 'phone'}=${encodeURIComponent(query.trim())}`} className={pillClass('raised', 'sm')}><CalendarPlus />Book as new client</Link></Empty>
      ) : (
        <div className={stackWrapClass}>
          <table className={stackTableClass} aria-label="Clients">
            <thead className={stackHeadClass}>
              <tr>
                <th scope="col" className={stackThClass}>Client</th>
                <th scope="col" className={stackThClass}>Contact</th>
                <th scope="col" className={cn(stackThClass, 'text-right')}>Visits</th>
                <th scope="col" className={stackThClass}>Last visit</th>
                <th scope="col" className={stackThClass}>Next appointment</th>
                <th scope="col" className={stackThClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className={stackBodyClass}>
              {filtered.map((row) => {
                const profile = `/dashboard/platform/clients/${row.id}`;
                const isEditing = editing === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className={cn(stackRowClass, 'grid-cols-[minmax(0,1fr)_auto]')}>
                      <td className={cn(stackCellClass, 'lg:min-w-44')}>
                        <Link href={profile} className="block truncate font-semibold underline-offset-4 hover:underline">{row.name}</Link>
                        <span className="text-xs text-muted-foreground">{row.account ? 'Account' : 'Guest'}</span>
                      </td>
                      <td className={cn(stackCellClass, 'col-start-1 text-sm')}>
                        {row.phone ? <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} className="block truncate tabular-nums underline-offset-4 hover:underline">{row.phone}</a> : null}
                        <span className="block truncate text-xs text-muted-foreground">{row.email || (row.phone ? '' : 'No contact recorded')}</span>
                      </td>
                      <td className={cn(stackCellClass, 'col-start-2 row-start-1 text-right tabular-nums')}>
                        {row.visits === null ? '—' : <><span className="font-medium">{row.visits}</span><span className="text-xs text-muted-foreground lg:hidden"> {row.visits === 1 ? 'visit' : 'visits'}</span></>}
                      </td>
                      <td className={cn(stackCellClass, 'col-span-2 whitespace-nowrap text-xs text-muted-foreground lg:text-sm lg:text-foreground')}>
                        <span className="lg:hidden">Last visit </span>{row.lastVisit || (row.visits === null ? '—' : 'Never')}
                      </td>
                      <td className={cn(stackCellClass, 'col-span-2 text-xs lg:text-sm', !row.next && 'hidden lg:table-cell')}>
                        {row.next ? <Link href={`/dashboard/platform/appointments/${row.next.id}`} className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium underline-offset-4 hover:underline"><span aria-hidden="true" className="size-1.5 rounded-full bg-blue-500" /><span className="lg:hidden">Next </span>{row.next.label}</Link> : <span className="text-muted-foreground">{row.visits === null ? '—' : 'None booked'}</span>}
                      </td>
                      <td className={cn(stackCellClass, 'col-span-2 lg:w-px')}>
                        <div className={cn(trackClass, 'flex-nowrap lg:justify-end')}>
                          <Link href={profile} className={pillClass('quiet', 'sm')}>Profile<ArrowUpRight /></Link>
                          <Link href={`/dashboard/platform/appointments/new?client=${row.id}`} className={pillClass('quiet', 'sm')}><CalendarPlus />Book</Link>
                          <button type="button" aria-expanded={isEditing} onClick={() => { setEditing(isEditing ? null : row.id); setAdding(false); }} className={pillClass(isEditing ? 'quiet' : 'raised', 'sm')}>{isEditing ? <X /> : <Pencil />}{isEditing ? 'Close' : 'Edit'}</button>
                        </div>
                      </td>
                    </tr>
                    {isEditing ? (
                      <tr className="block bg-muted/20 lg:table-row">
                        <td colSpan={6} className="block border-b p-4 lg:table-cell">
                          <ClientRecordForm record={row} locations={locations} onDone={() => setEditing(null)} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-dashed bg-background px-5 py-6 text-sm font-medium text-muted-foreground">{children}</div>;
}

function newOperationKey() {
  const secureId = globalThis.crypto?.randomUUID?.();
  return `salon-management:${secureId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`;
}

/** Create or edit a client's contact record through the shared salon record workflow. */
function ClientRecordForm({ record, locations, onDone }: { record?: DirectoryRow; locations: Array<{ id: string; name: string }>; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    const keyField = form.elements.namedItem('idempotencyKey') as HTMLInputElement | null;
    if (keyField && !keyField.value) keyField.value = newOperationKey();
    try {
      const result = await saveSalonRecordFromWorkspace(new FormData(form));
      if (!result.success) { setMessage({ ok: false, text: result.error || 'The client could not be saved.' }); return; }
      setMessage({ ok: true, text: record ? 'Client updated.' : 'Client created.' });
      router.refresh();
      if (record) onDone();
      else setVersion((value) => value + 1);
    } catch {
      setMessage({ ok: false, text: 'Couldn’t save. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form key={version} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid min-w-0 gap-3">
      <input type="hidden" name="kind" value="client" />
      <input type="hidden" name="recordId" value={record?.id || ''} />
      <input type="hidden" name="idempotencyKey" value="" />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className={fieldLabelClass}>Full name<input name="name" required maxLength={200} defaultValue={record?.name || ''} className={inputClass} /></label>
        <label className={fieldLabelClass}>Email<input name="email" type="email" required maxLength={200} defaultValue={record?.email || ''} readOnly={Boolean(record)} className={cn(inputClass, 'read-only:bg-muted/40')} /></label>
        <label className={fieldLabelClass}>Phone<input name="phone" type="tel" maxLength={200} defaultValue={record?.phone || ''} className={inputClass} /></label>
        <label className={fieldLabelClass}>Home location
          <select name="homeLocationId" defaultValue={record?.homeLocationId || ''} className={inputClass}>
            <option value="">Select home location</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Clients set their own password from the storefront.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          <button type="button" onClick={onDone} disabled={busy} className={pillClass('quiet')}>Cancel</button>
          <button type="submit" disabled={busy} className={pillClass('primary')}>{busy ? 'Saving…' : record ? 'Save changes' : 'Create client'}</button>
        </div>
        {message ? <p role={message.ok ? 'status' : 'alert'} className={cn('text-sm', message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>{message.text}</p> : null}
      </div>
    </form>
  );
}
