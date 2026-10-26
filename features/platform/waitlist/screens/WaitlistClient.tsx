'use client'

import React, { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Plus,
  Bell,
  X,
  CalendarPlus,
  RefreshCw,
} from 'lucide-react'
import { fieldLabelClass, inputClass, labelize, pillClass, tableClass, tdClass, thClass, textareaClass } from '../../components/pill'
import {
  getWaitlistQueue,
  joinWaitlist,
  transitionWaitlistEntry,
  type WaitlistQueue,
  type WaitlistQueueEntry,
} from '../actions/waitlist'

const ANY = 'any'

const EMPTY_ENTRY = {
  clientName: '',
  clientPhone: '',
  serviceId: '',
  stylistId: ANY,
  preferredTimeRange: ANY,
  notes: '',
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export function WaitlistClient({ initialQueue }: { initialQueue: WaitlistQueue; icon?: ReactNode }) {
  const [queue, setQueue] = useState<WaitlistQueue>(initialQueue)
  const [refreshing, setRefreshing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY)
  const [submitting, setSubmitting] = useState(false)
  // Kept until the server confirms, so a retry replays the same join request.
  const [joinKey, setJoinKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setQueue(await getWaitlistQueue())
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleAddEntry = async () => {
    if (!newEntry.clientName.trim() || !newEntry.serviceId) {
      setJoinError('Client name and service are required.')
      return
    }
    const idempotencyKey = joinKey ?? crypto.randomUUID()
    setJoinKey(idempotencyKey)
    setSubmitting(true)
    setJoinError(null)
    try {
      const result = await joinWaitlist({
        guestName: newEntry.clientName,
        guestPhone: newEntry.clientPhone || null,
        serviceId: newEntry.serviceId,
        preferredStylistId: newEntry.stylistId === ANY ? null : newEntry.stylistId,
        preferredTimeRange: newEntry.preferredTimeRange === ANY ? null : newEntry.preferredTimeRange,
        notes: newEntry.notes || null,
        idempotencyKey,
      })
      if (!result.success) {
        setJoinError(result.error)
        return
      }
      setNewEntry(EMPTY_ENTRY)
      setJoinKey(null)
      setFormOpen(false)
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransition = async (entry: WaitlistQueueEntry, action: 'notify' | 'remove') => {
    if (action === 'remove' && !confirm('Remove this entry from the waitlist?')) return
    setActionError(null)
    const result = await transitionWaitlistEntry(entry.id, action)
    if (!result.success) setActionError(result.error)
    await refresh()
  }

  const handleConvertToAppointment = (entry: WaitlistQueueEntry) => {
    const params = new URLSearchParams()
    if (entry.service?.id) params.set('service', entry.service.id)
    if (entry.preferredStylists?.[0]?.id) params.set('stylist', entry.preferredStylists[0].id)
    params.set('waitlist', entry.id)
    // A waitlist client is a User; the booking page resolves it to the Client record.
    if (entry.client?.id) params.set('user', entry.client.id)
    else {
      if (entry.guestName) params.set('name', entry.guestName)
      if (entry.guestPhone) params.set('phone', entry.guestPhone)
    }
    window.location.href = `/dashboard/platform/appointments/new?${params.toString()}`
  }

  if (queue.status === 'error') {
    return (
      <div className="grid gap-6">
        <WaitlistHeader />
        <section role="alert" className="rounded-[6px] border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <h2 className="text-base font-semibold">Waitlist unavailable</h2>
          <p className="mt-1.5 text-sm opacity-90">{queue.message}</p>
          <div className="mt-4">
            <button type="button" onClick={refresh} disabled={refreshing} className={pillClass('primary')}><RefreshCw />{refreshing ? 'Retrying…' : 'Retry'}</button>
          </div>
        </section>
      </div>
    )
  }

  const { entries, total, truncated, services, servicesTruncated, stylists, stylistsTruncated } = queue

  const notified = entries.filter((entry) => entry.notifiedAt).length
  const waiting = Math.max(0, total - notified)
  const longestWaiting = entries.find((entry) => entry.status !== 'notified')

  return (
    <div className="grid gap-5">
      <WaitlistHeader
        waiting={waiting}
        meta={entries.length ? <span>{notified} notified{longestWaiting ? ` · longest wait ${formatTimeAgo(longestWaiting.createdAt).replace(' ago', '')}` : ''}</span> : null}
        actions={<>
          <button type="button" onClick={refresh} disabled={refreshing} className={pillClass('quiet')}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" aria-expanded={formOpen} aria-controls="add-walk-in" onClick={() => setFormOpen((open) => !open)} className={`${pillClass(formOpen ? 'raised' : 'primary')} md:hidden`}>
            {formOpen ? <X /> : <Plus />}{formOpen ? 'Close' : 'Add walk-in'}
          </button>
        </>}
      />

      <section id="add-walk-in" aria-labelledby="add-walk-in-title" className={`${formOpen ? 'block' : 'hidden'} min-w-0 overflow-hidden rounded-[6px] border bg-background md:block`}>
        <div className="flex min-h-10 items-center border-b bg-muted/30 px-4 py-1.5"><h2 id="add-walk-in-title" className="text-[13px] font-semibold">Add walk-in</h2></div>
        <form onSubmit={(event) => { event.preventDefault(); void handleAddEntry() }} className="grid gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className={fieldLabelClass}>Client name
              <input required value={newEntry.clientName} onChange={(e) => setNewEntry({ ...newEntry, clientName: e.target.value })} className={inputClass} autoComplete="off" />
            </label>
            <label className={fieldLabelClass}>Phone
              <input type="tel" value={newEntry.clientPhone} onChange={(e) => setNewEntry({ ...newEntry, clientPhone: e.target.value })} placeholder="(555) 123-4567" className={inputClass} />
            </label>
            <label className={fieldLabelClass}>Service
              <select required value={newEntry.serviceId} onChange={(e) => setNewEntry({ ...newEntry, serviceId: e.target.value })} className={inputClass}>
                <option value="">Select service</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.baseDuration ? ` (${service.baseDuration} min)` : ''}</option>)}
              </select>
              {servicesTruncated ? <span className="font-normal">First {services.length} active services</span> : null}
            </label>
            <label className={fieldLabelClass}>Preferred stylist
              <select value={newEntry.stylistId} onChange={(e) => setNewEntry({ ...newEntry, stylistId: e.target.value })} className={inputClass}>
                <option value={ANY}>Any available</option>
                {stylists.map((stylist) => <option key={stylist.id} value={stylist.id}>{stylist.name}{stylist.tier ? ` (${labelize(stylist.tier)})` : ''}</option>)}
              </select>
              {stylistsTruncated ? <span className="font-normal">First {stylists.length} active stylists</span> : null}
            </label>
            <label className={fieldLabelClass}>Preferred time
              <select value={newEntry.preferredTimeRange} onChange={(e) => setNewEntry({ ...newEntry, preferredTimeRange: e.target.value })} className={inputClass}>
                <option value={ANY}>Anytime</option>
                <option value="morning">Morning (9am–12pm)</option>
                <option value="afternoon">Afternoon (12pm–5pm)</option>
                <option value="evening">Evening (5pm–8pm)</option>
              </select>
            </label>
          </div>
          <label className={fieldLabelClass}>Notes
            <textarea value={newEntry.notes} onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })} rows={2} className={`${textareaClass} min-h-0`} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={submitting} className={pillClass('primary')}><Plus />{submitting ? 'Adding…' : 'Add to waitlist'}</button>
            {joinError ? <p role="alert" className="text-sm text-destructive">{joinError}</p> : null}
          </div>
        </form>
      </section>

      {truncated && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the {entries.length} longest-waiting of {total} active entries.
        </p>
      )}

      <section aria-labelledby="wait-order" className="grid gap-2">
        <h2 id="wait-order" className="text-sm font-semibold">Wait order</h2>
        <div className="min-w-0 relative overflow-x-auto rounded-[6px] border bg-background">
          <table className={tableClass} aria-labelledby="wait-order">
            <thead>
              <tr>
                <th scope="col" className={`${thClass} w-10 text-right`}>#</th>
                <th scope="col" className={thClass}>Client</th>
                <th scope="col" className={`${thClass} hidden md:table-cell`}>Service</th>
                <th scope="col" className={`${thClass} hidden lg:table-cell`}>Preference</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={`${thClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className={`${tdClass} py-6 text-center text-muted-foreground`}>No one waiting</td></tr>
              ) : entries.map((entry, index) => {
                const preference = [entry.preferredTimeRange ? labelize(entry.preferredTimeRange) : null, entry.preferredStylists.length ? `Prefers ${entry.preferredStylists.map((s) => s.user?.name || 'Stylist').join(', ')}` : null].filter(Boolean).join(' · ')
                return (
                  <tr key={entry.id} className="hover:bg-muted/20">
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{index + 1}</td>
                    <td className={tdClass}>
                      <span className="font-medium">{entry.client?.name || entry.guestName || 'Walk-in'}</span>
                      {entry.guestPhone ? <span className="block text-xs tabular-nums text-muted-foreground">{entry.guestPhone}</span> : null}
                      <span className="block text-xs text-muted-foreground md:hidden">{entry.service?.name || 'Any service'}</span>
                      {entry.notes ? <span className="mt-0.5 block text-xs text-muted-foreground">Note: {entry.notes}</span> : null}
                    </td>
                    <td className={`${tdClass} hidden md:table-cell`}>{entry.service?.name || 'Any service'}</td>
                    <td className={`${tdClass} hidden text-muted-foreground lg:table-cell`}>{preference || 'Any'}</td>
                    <td className={tdClass}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
                        <span aria-hidden="true" className={`inline-block size-2 rounded-full outline-3 -outline-offset-1 ${entry.notifiedAt ? 'bg-emerald-500 outline-emerald-100 dark:outline-emerald-900/50' : 'bg-amber-500 outline-amber-100 dark:outline-amber-900/50'}`} />
                        {entry.notifiedAt ? 'Notified' : 'Waiting'}
                      </span>
                      <span className="block text-xs tabular-nums text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex flex-wrap justify-end gap-1.5" role="group" aria-label="Waitlist entry actions">
                        <button type="button" onClick={() => handleConvertToAppointment(entry)} className={pillClass('primary', 'sm')}><CalendarPlus />Book</button>
                        {!entry.notifiedAt ? <button type="button" onClick={() => handleTransition(entry, 'notify')} className={pillClass('raised', 'sm')}><Bell />Mark notified</button> : null}
                        <button type="button" aria-label="Remove from waitlist" onClick={() => handleTransition(entry, 'remove')} className={pillClass('quiet', 'sm')}><X /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
      </section>
    </div>
  )
}

function WaitlistHeader({ waiting, meta, actions }: { waiting?: number; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-[1.375rem]">Walk-in waitlist</h1>
          {waiting ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
              <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-amber-500 outline-3 -outline-offset-1 outline-amber-100 dark:outline-amber-900/50" />
              {waiting} waiting
            </span>
          ) : null}
        </div>
        {meta ? <div className="mt-1 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}
