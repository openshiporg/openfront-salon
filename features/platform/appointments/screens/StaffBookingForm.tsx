'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Search } from 'lucide-react';
import { TimeSlotPicker } from '@/features/storefront/components/TimeSlotPicker';
import { getStylistsForService, type Stylist } from '@/features/storefront/lib/data/stylists';
import { getAvailableTimeSlots, type BookingSlot } from '@/features/storefront/lib/data/availability';
import { fieldLabelClass, inputClass, pillClass, textareaClass, trackClass } from '../../components/pill';
import { bookForClient, type StaffBookingData } from '../actions/staffBooking';
import '@/features/storefront/styles/storefront.css';

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
    setDate(undefined);
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
    if (!date || !serviceId || !stylistId || !locationId) return;
    setLoadingSlots(true);
    getAvailableTimeSlots(stylistId, localDateKey(date), service?.baseDuration || 60, serviceId, locationId)
      .then((result) => { if (!cancelled) setSlots(result); })
      .catch(() => { if (!cancelled) setError('Availability could not be checked.'); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [date, serviceId, stylistId, locationId, service?.baseDuration]);

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

  if (bookedId) {
    return (
      <section role="status" className="grid gap-4 rounded-2xl border bg-background p-5">
        <h2 className="text-base font-semibold">Booked {who?.name}</h2>
        <p className="text-sm text-muted-foreground">{service?.name} · {slots.find((slot) => slot.startTime === time)?.label} · {date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        {waitlistError ? <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">Waitlist entry still open: {waitlistError}</p> : null}
        <div className={`${trackClass} justify-self-start`}>
          <Link href={`/dashboard/platform/appointments/${bookedId}`} className={pillClass('primary')}>Open appointment</Link>
          <Link href="/dashboard/platform/appointments/new" className={pillClass('quiet')}>Book another</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="grid gap-5">
      <section aria-labelledby="booking-client" className="grid gap-4 rounded-2xl border bg-background p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="booking-client" className="text-sm font-semibold">Client</h2>
          <div className={trackClass} role="group" aria-label="Client source">
            <button type="button" aria-pressed={mode === 'existing'} disabled={data.clients.length === 0} onClick={() => setMode('existing')} className={pillClass(mode === 'existing' ? 'raised' : 'quiet', 'sm')}>Existing</button>
            <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')} className={pillClass(mode === 'new' ? 'raised' : 'quiet', 'sm')}>New client</button>
          </div>
        </div>
        {mode === 'existing' ? (
          <div className="grid gap-2">
            <label className={fieldLabelClass}>Search clients
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email or phone" className={`${inputClass} pl-9`} />
              </span>
            </label>
            <ul className="divide-y overflow-hidden rounded-xl border" aria-label="Matching clients">
              {matches.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No matching clients</li> : matches.map((item) => (
                <li key={item.id}>
                  <button type="button" aria-pressed={clientId === item.id} onClick={() => setClientId(item.id)} className={`flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors ${clientId === item.id ? 'bg-muted' : 'hover:bg-muted/50'}`}>
                    <span className="min-w-0"><span className="block truncate font-medium">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{[item.email, item.phone].filter(Boolean).join(' · ')}</span></span>
                    {clientId === item.id ? <span className="shrink-0 text-xs font-medium">Selected</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={fieldLabelClass}>Name<input required value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} maxLength={120} autoComplete="off" className={inputClass} /></label>
            <label className={fieldLabelClass}>Email<input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} maxLength={254} autoComplete="off" className={inputClass} /></label>
            <label className={fieldLabelClass}>Phone<input type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} maxLength={40} autoComplete="off" className={inputClass} /></label>
          </div>
        )}
      </section>

      <section aria-labelledby="booking-service" className="grid gap-4 rounded-2xl border bg-background p-4 md:p-5">
        <h2 id="booking-service" className="text-sm font-semibold">Service</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={fieldLabelClass}>Service
            <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={inputClass}>
              <option value="">Choose a service</option>
              {data.services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.baseDuration} min</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>Stylist
            <select required value={stylistId} onChange={(event) => { setStylistId(event.target.value); setDate(undefined); }} disabled={!serviceId || stylists === null} className={inputClass}>
              <option value="">{!serviceId ? 'Choose a service first' : stylists === null ? 'Loading…' : stylists.length === 0 ? 'No qualified stylists' : 'Choose a stylist'}</option>
              {(stylists || []).map((item) => <option key={item.id} value={item.id}>{item.user?.name || 'Stylist'}</option>)}
            </select>
          </label>
          {data.locations.length > 1 ? (
            <label className={fieldLabelClass}>Location
              <select required value={locationId} onChange={(event) => { setLocationId(event.target.value); setDate(undefined); }} className={inputClass}>
                <option value="">Choose a location</option>
                {data.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {serviceId && stylistId && locationId ? (
        <section aria-labelledby="booking-time" className="storefront grid min-w-0 gap-4 rounded-2xl border !bg-background p-4 md:p-5">
          <h2 id="booking-time" className="text-sm font-semibold">Time</h2>
          <TimeSlotPicker selectedDate={date} onDateSelect={setDate} selectedTime={time} onTimeSelect={setTime} availableSlots={slots} loadingSlots={loadingSlots} />
        </section>
      ) : null}

      <label className={fieldLabelClass}>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className={textareaClass} /></label>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          <button type="submit" disabled={!ready || submitting} aria-describedby={missing ? 'booking-missing' : undefined} className={pillClass('primary')}><CalendarPlus />{submitting ? 'Booking…' : 'Book appointment'}</button>
        </div>
        {missing ? <span id="booking-missing" className="text-xs text-muted-foreground">{missing}</span> : null}
      </div>
    </form>
  );
}
