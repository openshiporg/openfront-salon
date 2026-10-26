'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarPlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStylistsForService, type Stylist } from '@/features/storefront/lib/data/stylists';
import { getAvailableTimeSlots, type BookingSlot } from '@/features/storefront/lib/data/availability';
import { fieldLabelClass, inputClass, pillClass, textareaClass, trackClass } from '../../components/pill';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
import { bookForClient, type StaffBookingData } from '../actions/staffBooking';
import { DeskSlotPicker } from './DeskSlotPicker';

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type Initial = { serviceId: string; stylistId: string; clientId: string; name: string; phone: string; email: string; waitlistEntryId: string };

/** Front-desk booking: pick or create the client, then service, stylist and an open slot. */
export function StaffBookingForm({ data, initial }: { data: StaffBookingData; initial: Initial }) {
  const startNew = !initial.clientId && Boolean(initial.name || initial.phone || initial.email);
  const [mode, setMode] = useState<'existing' | 'new'>(startNew || data.clients.length === 0 ? 'new' : 'existing');
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState(data.clients.some((client) => client.id === initial.clientId) ? initial.clientId : '');
  const [contact, setContact] = useState({ name: initial.name, email: initial.email, phone: initial.phone });
  const [serviceId, setServiceId] = useState(data.services.some((service) => service.id === initial.serviceId) ? initial.serviceId : '');
  const [stylists, setStylists] = useState<Stylist[] | null>(null);
  const [stylistId, setStylistId] = useState(initial.stylistId);
  const [locationId, setLocationId] = useState(data.locations.length === 1 ? data.locations[0].id : '');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedId, setBookedId] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState('');

  useEffect(() => { setRequestKey(`staff-booking:${crypto.randomUUID()}`); }, []);

  const service = data.services.find((item) => item.id === serviceId);
  const client = data.clients.find((item) => item.id === clientId);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle ? data.clients.filter((item) => `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(needle)) : data.clients;
    return list.slice(0, 8);
  }, [data.clients, query]);

  useEffect(() => {
    let cancelled = false;
    setStylists(null);
    setTime(null);
    if (!serviceId) return;
    getStylistsForService(serviceId)
      .then((result) => {
        if (cancelled) return;
        const items = result.status === 'available' ? result.items : [];
        setStylists(items);
        setStylistId((current) => items.some((item) => item.id === current) ? current : items.length === 1 ? items[0].id : '');
      })
      .catch(() => { if (!cancelled) setStylists([]); });
    return () => { cancelled = true; };
  }, [serviceId]);

  useEffect(() => {
    let cancelled = false;
    setTime(null);
    setSlots([]);
    setSlotsFailed(false);
    if (!date || !serviceId || !stylistId || !locationId) return;
    setLoadingSlots(true);
    getAvailableTimeSlots(stylistId, localDateKey(date), service?.baseDuration || 60, serviceId, locationId)
      .then((result) => { if (!cancelled) setSlots(result); })
      .catch(() => { if (!cancelled) setSlotsFailed(true); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [date, serviceId, stylistId, locationId, service?.baseDuration, retry]);

  const who = mode === 'existing' ? client : contact.name.trim() && (contact.email.trim() || contact.phone.trim()) ? contact : null;
  const ready = Boolean(who && serviceId && stylistId && locationId && time && requestKey);
  const missing = !who ? (mode === 'existing' ? 'Choose a client' : !contact.name.trim() ? 'Add the client name' : 'Add a phone number or email')
    : !serviceId ? 'Choose a service' : !stylistId ? 'Choose a stylist' : !locationId ? 'Choose a location' : !time ? 'Choose a time' : null;

  async function submit() {
    if (!ready || !who) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bookForClient({
        clientId: mode === 'existing' ? client?.id : undefined,
        locationId,
        requestKey,
        startTime: time!,
        stylistId,
        serviceId,
        clientName: who.name.trim(),
        clientEmail: who.email.trim(),
        clientPhone: who.phone.trim() || undefined,
        clientNotes: notes || undefined,
        waitlistEntryId: initial.waitlistEntryId || undefined,
      });
      if (result.status === 'accepted') {
        setBookedId(result.appointmentId);
        setWaitlistError(result.waitlistError || null);
      }
      else if (result.status === 'rejected') setError(result.error);
      else setError('The booking could not be confirmed. Check Appointments before trying again.');
    } catch {
      setError('The booking could not be confirmed. Check Appointments before trying again.');
    } finally {
      setSubmitting(false);
    }
  }

  const slotLabel = slots.find((slot) => slot.startTime === time)?.label;
  const dateLabel = date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const stylistName = (stylists || []).find((item) => item.id === stylistId)?.user?.name;
  const blockedReason = !serviceId ? 'Choose a service to see open times' : !stylistId ? (stylists !== null && stylists.length === 0 ? 'No stylist offers this service' : 'Choose a stylist to see open times') : !locationId ? 'Choose a location to see open times' : null;

  if (bookedId) {
    return (
      <section role="status" className="grid gap-4 rounded-[6px] border bg-background p-4 md:p-5">
        <h2 className="text-base font-semibold">Booked {who?.name}</h2>
        <p className="text-sm text-muted-foreground">{[service?.name, slotLabel, dateLabel].filter(Boolean).join(' · ')}</p>
        {waitlistError ? <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">Waitlist entry still open: {waitlistError}</p> : null}
        <div className={`${trackClass} justify-self-start`}>
          <Link href={`/dashboard/platform/appointments/${bookedId}`} className={pillClass('primary')}>Open appointment</Link>
          <Link href="/dashboard/platform/appointments/new" className={pillClass('quiet')}>Book another</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid min-w-0 gap-5">
        <Section id="booking-service" title="Service and stylist">
          <div className={cn('grid gap-3', data.locations.length > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            <label className={fieldLabelClass}>Service
              <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={inputClass}>
                <option value="">Choose a service</option>
                {data.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.baseDuration} min</option>)}
              </select>
            </label>
            <label className={fieldLabelClass}>Stylist
              <select required value={stylistId} onChange={(event) => setStylistId(event.target.value)} disabled={!serviceId || stylists === null} className={inputClass}>
                <option value="">{!serviceId ? 'Choose a service first' : stylists === null ? 'Loading…' : stylists.length === 0 ? 'No qualified stylists' : 'Choose a stylist'}</option>
                {(stylists || []).map((item) => <option key={item.id} value={item.id}>{item.user?.name || 'Stylist'}</option>)}
              </select>
            </label>
            {data.locations.length > 1 ? (
              <label className={fieldLabelClass}>Location
                <select required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}>
                  <option value="">Choose a location</option>
                  {data.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </Section>

        <Section id="booking-time" title="Date and time">
          <DeskSlotPicker
            date={date}
            onDateSelect={setDate}
            time={time}
            onTimeSelect={setTime}
            slots={slots}
            loading={loadingSlots}
            failed={slotsFailed}
            onRetry={() => setRetry((value) => value + 1)}
            blockedReason={blockedReason}
          />
        </Section>

        <Section
          id="booking-client"
          title="Client"
          actions={
            <fieldset className="inline-flex overflow-hidden rounded-[6px] border text-xs font-medium">
              <legend className="sr-only">Client source</legend>
              {([['existing', 'Existing client'], ['new', 'New client']] as const).map(([value, label], index) => {
                const disabled = value === 'existing' && data.clients.length === 0;
                return (
                  <label key={value} className={cn('relative inline-flex h-8 cursor-pointer select-none items-center px-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring', index > 0 && 'border-l', mode === value ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground', disabled && 'pointer-events-none opacity-45')}>
                    <input type="radio" name="clientSource" value={value} checked={mode === value} disabled={disabled} onChange={() => setMode(value)} className="sr-only" />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          }
        >
          {mode === 'existing' ? (
            <div className="grid gap-2">
              <label className={fieldLabelClass}><span className="sr-only">Search clients</span>
                <span className="relative block">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email or phone" aria-label="Search clients" className={`${inputClass} pl-8`} />
                </span>
              </label>
              <ul className="divide-y overflow-hidden rounded-[6px] border" aria-label="Matching clients">
                {matches.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No matching clients</li> : matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" aria-pressed={clientId === item.id} onClick={() => setClientId(item.id)} className={cn('flex min-h-10 w-full min-w-0 items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', clientId === item.id ? 'bg-muted' : 'hover:bg-muted/50')}>
                      <span className="min-w-0"><span className="block truncate font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{[item.phone, item.email].filter(Boolean).join(' · ')}</span></span>
                      {clientId === item.id ? <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium"><span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />Selected</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={fieldLabelClass}>Name<input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} maxLength={120} autoComplete="off" className={inputClass} /></label>
              <label className={fieldLabelClass}>Phone<input type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} maxLength={40} autoComplete="off" className={inputClass} /></label>
              <label className={fieldLabelClass}>Email<input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} maxLength={254} autoComplete="off" className={inputClass} /></label>
            </div>
          )}
        </Section>

        <label className={fieldLabelClass}>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className={textareaClass} /></label>
      </div>

      <aside aria-label="Booking summary" className="min-w-0 overflow-hidden rounded-[6px] border bg-background lg:sticky lg:top-4">
        <h2 className="flex min-h-10 items-center border-b bg-muted/30 px-4 text-[13px] font-semibold">Booking</h2>
        <dl className="grid gap-2.5 p-4 text-sm">
          <SummaryRow label="Client" value={who?.name || null} />
          <SummaryRow label="Service" value={service ? `${service.name} · ${service.baseDuration} min` : null} />
          <SummaryRow label="Stylist" value={stylistName || null} />
          <SummaryRow label="When" value={time && slotLabel ? `${dateLabel} · ${slotLabel}` : dateLabel ? `${dateLabel} · time not chosen` : null} />
          {service?.price !== null && service?.price !== undefined ? <SummaryRow label="Price" value={usd(service.price)} /> : null}
        </dl>
        <div className="grid gap-2 border-t p-4">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <button type="submit" disabled={!ready || submitting} aria-describedby={missing ? 'booking-missing' : undefined} className={cn(pillClass('primary'), 'h-10 w-full')}><CalendarPlus />{submitting ? 'Booking…' : 'Book appointment'}</button>
          {missing ? <span id="booking-missing" className="text-xs text-muted-foreground">{missing}</span> : null}
        </div>
      </aside>
    </form>
  );
}

function Section({ id, title, actions, children }: { id: string; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-1.5">
        <h2 id={id} className="text-[13px] font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words', value ? 'font-medium' : 'text-muted-foreground/70')}>{value || '—'}</dd>
    </div>
  );
}
