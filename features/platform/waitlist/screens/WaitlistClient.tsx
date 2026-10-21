'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  User,
  Bell,
  X,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
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

export function WaitlistClient({ initialQueue }: { initialQueue: WaitlistQueue }) {
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
    const serviceParam = entry.service?.id ? `service=${entry.service.id}` : ''
    const stylistParam = entry.preferredStylists?.[0]?.id
      ? `&stylist=${entry.preferredStylists[0].id}`
      : ''
    window.location.href = `/book?${serviceParam}${stylistParam}`
  }

  if (queue.status === 'error') {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p role="alert" className="text-sm text-destructive">{queue.message}</p>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { entries, total, truncated, services, servicesTruncated, stylists, stylistsTruncated } = queue

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{total} waiting</Badge>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing} aria-label="Refresh waitlist">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <Dialog
          open={addDialogOpen}
          onOpenChange={(open) => {
            setAddDialogOpen(open)
            if (!open) setActionError(null)
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add to Waitlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Waitlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Client Name *</Label>
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
                <Label>Preferred Stylist</Label>
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
                        {stylist.name}{stylist.tier ? ` (${stylist.tier})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stylistsTruncated && (
                  <p className="mt-1 text-xs text-muted-foreground">Showing the first {stylists.length} active stylists.</p>
                )}
              </div>
              <div>
                <Label>Preferred Time</Label>
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
                  placeholder="Any special requests..."
                />
              </div>
              {actionError && addDialogOpen && (
                <p role="alert" className="text-sm text-destructive">{actionError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEntry} disabled={submitting}>
                {submitting ? 'Adding…' : 'Add to Waitlist'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {actionError && !addDialogOpen && (
        <p role="alert" className="text-sm text-destructive">{actionError}</p>
      )}

      {truncated && (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the {entries.length} longest-waiting of {total} active entries.
        </p>
      )}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No one waiting</h3>
            <p className="text-muted-foreground">
              Add walk-in clients to the waitlist as they arrive
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {entry.client?.name || entry.guestName || 'Walk-in'}
                        </span>
                        {entry.notifiedAt && (
                          <Badge variant="outline" className="text-green-600">
                            <Bell className="h-3 w-3 mr-1" />
                            Notified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                        {entry.service && (
                          <span>{entry.service.name}</span>
                        )}
                        {entry.preferredTimeRange && (
                          <span className="capitalize">
                            {entry.preferredTimeRange}
                          </span>
                        )}
                      </div>
                      {entry.preferredStylists.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>
                            Prefers:{' '}
                            {entry.preferredStylists
                              .map((s) => s.user?.name || 'Stylist')
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      {entry.notes && (
                        <div className="text-sm text-muted-foreground italic">
                          &ldquo;{entry.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!entry.notifiedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTransition(entry, 'notify')}
                      >
                        <Bell className="h-4 w-4 mr-1" />
                        Notify
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConvertToAppointment(entry)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Book
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remove from waitlist"
                      onClick={() => handleTransition(entry, 'remove')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
