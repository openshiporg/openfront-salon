'use client'

import React, { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus,
  Clock,
  Bell,
  X,
  CalendarPlus,
  RefreshCw,
} from 'lucide-react'
import { labelize, pillClass, trackClass } from '../../components/pill'
import {
  getWaitlistQueue,
  joinWaitlist,
  transitionWaitlistEntry,
  type WaitlistQueue,
  type WaitlistQueueEntry,
} from '../actions/waitlist'

// Radix Select items cannot use an empty-string value.
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

export function WaitlistClient({ initialQueue, icon }: { initialQueue: WaitlistQueue; icon?: ReactNode }) {
  const [queue, setQueue] = useState<WaitlistQueue>(initialQueue)
  const [refreshing, setRefreshing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
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
      setActionError('Client name and service are required.')
      return
    }
    const idempotencyKey = joinKey ?? crypto.randomUUID()
    setJoinKey(idempotencyKey)
    setSubmitting(true)
    setActionError(null)
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
        setActionError(result.error)
        return
      }
      setNewEntry(EMPTY_ENTRY)
      setJoinKey(null)
      setAddDialogOpen(false)
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
    if (entry.client?.id) params.set('client', entry.client.id)
    else {
      if (entry.guestName) params.set('name', entry.guestName)
      if (entry.guestPhone) params.set('phone', entry.guestPhone)
    }
    window.location.href = `/dashboard/platform/appointments/new?${params.toString()}`
  }

  if (queue.status === 'error') {
    return (
      <div className="grid gap-6">
        <WaitlistHeader icon={icon} />
        <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <h2 className="text-base font-semibold">Waitlist unavailable</h2>
          <p className="mt-1.5 text-sm opacity-90">{queue.message}</p>
          <div className={`${trackClass} mt-4`}>
            <button type="button" onClick={refresh} disabled={refreshing} className={pillClass('primary')}><RefreshCw />Retry</button>
          </div>
        </section>
      </div>
    )
  }

  const { entries, total, truncated, services, servicesTruncated, stylists, stylistsTruncated } = queue

  const notified = entries.filter((entry) => entry.notifiedAt).length
  const waiting = Math.max(0, total - notified)

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <WaitlistHeader icon={icon} total={waiting} />
        <div className="flex items-center gap-2">
          <div className={trackClass}>
            <button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh waitlist" className={pillClass('quiet')}>
              <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Dialog
              open={addDialogOpen}
              onOpenChange={(open) => {
                setAddDialogOpen(open)
                if (!open) setActionError(null)
              }}
            >
              <DialogTrigger asChild>
                <button type="button" className={pillClass('primary')}>
                  <Plus />
                  Add walk-in
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add walk-in</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Client name *</Label>
                    <Input
                      value={newEntry.clientName}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, clientName: e.target.value })
                      }
                      placeholder="Walk-in client name"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={newEntry.clientPhone}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, clientPhone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label>Service *</Label>
                    <Select
                      value={newEntry.serviceId}
                      onValueChange={(v) =>
                        setNewEntry({ ...newEntry, serviceId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}{service.baseDuration ? ` (${service.baseDuration}min)` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {servicesTruncated && (
                      <p className="mt-1 text-xs text-muted-foreground">Showing the first {services.length} active services.</p>
                    )}
                  </div>
                  <div>
                    <Label>Preferred stylist</Label>
                    <Select
                      value={newEntry.stylistId}
                      onValueChange={(v) =>
                        setNewEntry({ ...newEntry, stylistId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any available" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Any available</SelectItem>
                        {stylists.map((stylist) => (
                          <SelectItem key={stylist.id} value={stylist.id}>
                            {stylist.name}{stylist.tier ? ` (${labelize(stylist.tier)})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stylistsTruncated && (
                      <p className="mt-1 text-xs text-muted-foreground">Showing the first {stylists.length} active stylists.</p>
                    )}
                  </div>
                  <div>
                    <Label>Preferred time</Label>
                    <Select
                      value={newEntry.preferredTimeRange}
                      onValueChange={(v) =>
                        setNewEntry({ ...newEntry, preferredTimeRange: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Anytime" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY}>Anytime</SelectItem>
                        <SelectItem value="morning">Morning (9am-12pm)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12pm-5pm)</SelectItem>
                        <SelectItem value="evening">Evening (5pm-8pm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newEntry.notes}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, notes: e.target.value })
                      }
                      
                    />
                  </div>
                  {actionError && addDialogOpen && (
                    <p role="alert" className="text-sm text-destructive">{actionError}</p>
                  )}
                </div>
                <DialogFooter>
                  <div className={trackClass}>
                    <button type="button" onClick={() => setAddDialogOpen(false)} className={pillClass('quiet')}>
                      Cancel
                    </button>
                    <button type="button" onClick={handleAddEntry} disabled={submitting} className={pillClass('primary')}>
                      {submitting ? 'Adding…' : 'Add to waitlist'}
                    </button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border bg-border [&>*]:bg-background" style={{ gap: 1 }}>
        <div className="p-4"><dt className="text-xs font-medium text-muted-foreground">Waiting</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{waiting}</dd></div>
        <div className="p-4"><dt className="text-xs font-medium text-muted-foreground">Notified</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{notified}</dd></div>
        <div className="p-4"><dt className="text-xs font-medium text-muted-foreground">Longest wait</dt><dd className="mt-1.5 text-xl font-semibold tabular-nums">{entries[0] ? formatTimeAgo(entries[0].createdAt).replace(' ago', '') : '—'}</dd></div>
      </dl>

      {actionError && !addDialogOpen && (
        <p role="alert" className="text-sm text-destructive">{actionError}</p>
      )}

      {truncated && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the {entries.length} longest-waiting of {total} active entries.
        </p>
      )}

      {entries.length === 0 ? (
        <section className="flex flex-col items-center rounded-2xl border border-dashed bg-background px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted"><Clock className="size-5 text-muted-foreground" /></span>
          <h2 className="mt-4 text-base font-semibold">No one waiting</h2>
        </section>
      ) : (
        <ol className="divide-y overflow-hidden rounded-2xl border bg-background">
          {entries.map((entry, index) => (
            <li key={entry.id} className="grid min-w-0 gap-3 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-center md:p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">{index + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="truncate text-base font-semibold">{entry.client?.name || entry.guestName || 'Walk-in'}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span aria-hidden="true" className={`size-2 rounded-full outline-3 -outline-offset-1 ${entry.notifiedAt ? 'bg-emerald-500 outline-emerald-100 dark:outline-emerald-900/50' : 'bg-amber-500 outline-amber-100 dark:outline-amber-900/50'}`} />
                    {entry.notifiedAt ? 'Notified' : 'Waiting'} · {formatTimeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {[entry.service?.name, entry.preferredTimeRange ? entry.preferredTimeRange.replace(/^./, (letter) => letter.toUpperCase()) : null, entry.preferredStylists.length ? `Prefers ${entry.preferredStylists.map((s) => s.user?.name || 'Stylist').join(', ')}` : null].filter(Boolean).join(' · ') || 'Any service'}
                </p>
                {entry.notes ? <p className="mt-1 text-sm text-muted-foreground">&ldquo;{entry.notes}&rdquo;</p> : null}
              </div>
              <div className={trackClass} role="group" aria-label="Waitlist entry actions">
                {!entry.notifiedAt ? (
                  <button type="button" onClick={() => handleTransition(entry, 'notify')} className={pillClass('raised', 'sm')}>
                    <Bell />Mark notified
                  </button>
                ) : null}
                <button type="button" onClick={() => handleConvertToAppointment(entry)} className={pillClass('primary', 'sm')}>
                  <CalendarPlus />Book
                </button>
                <button type="button" aria-label="Remove from waitlist" onClick={() => handleTransition(entry, 'remove')} className={pillClass('quiet', 'sm')}>
                  <X />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function WaitlistHeader({ icon, total }: { icon?: ReactNode; total?: number }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {icon ? <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span> : null}
      <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">Walk-in waitlist</h1>
      {total !== undefined ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className={`size-2 rounded-full outline-3 -outline-offset-1 ${total > 0 ? 'bg-amber-500 outline-amber-100 dark:outline-amber-900/50' : 'bg-emerald-500 outline-emerald-100 dark:outline-emerald-900/50'}`} />
          {total > 0 ? `${total} waiting` : 'No one waiting'}
        </span>
      ) : null}
    </header>
  )
}
