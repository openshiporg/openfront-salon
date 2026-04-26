'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Phone,
  Clock,
  User,
  Calendar,
  Bell,
  X,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { gql, request } from 'graphql-request'

interface WaitlistEntry {
  id: string
  client: {
    id: string
    name: string
    email: string
  } | null
  service: {
    id: string
    name: string
    baseDuration: number
  } | null
  preferredStylists: {
    id: string
    user: { name: string }
  }[]
  preferredTimeRange: string | null
  dateRangeStart: string | null
  dateRangeEnd: string | null
  isActive: boolean
  notifiedAt: string | null
  notes: string | null
  createdAt: string
}

interface Service {
  id: string
  name: string
  baseDuration: number
}

interface Stylist {
  id: string
  user: { name: string }
  tier: string
}

const GET_WAITLIST_ENTRIES = gql`
  query GetWaitlistEntries {
    waitlistEntries(
      where: { isActive: { equals: true } }
      orderBy: { createdAt: asc }
    ) {
      id
      client {
        id
        name
        email
      }
      service {
        id
        name
        baseDuration
      }
      preferredStylists {
        id
        user { name }
      }
      preferredTimeRange
      dateRangeStart
      dateRangeEnd
      isActive
      notifiedAt
      notes
      createdAt
    }
  }
`

const GET_SERVICES = gql`
  query GetServices {
    services(where: { status: { equals: active } }, orderBy: { name: asc }) {
      id
      name
      baseDuration
    }
  }
`

const GET_STYLISTS = gql`
  query GetStylists {
    stylists(where: { isActive: { equals: true } }, orderBy: { user: { name: asc } }) {
      id
      user { name }
      tier
    }
  }
`

const CREATE_WAITLIST_ENTRY = gql`
  mutation CreateWaitlistEntry($data: WaitlistEntryCreateInput!) {
    createWaitlistEntry(data: $data) {
      id
    }
  }
`

const UPDATE_WAITLIST_ENTRY = gql`
  mutation UpdateWaitlistEntry($id: ID!, $data: WaitlistEntryUpdateInput!) {
    updateWaitlistEntry(where: { id: $id }, data: $data) {
      id
    }
  }
`

const DELETE_WAITLIST_ENTRY = gql`
  mutation DeleteWaitlistEntry($id: ID!) {
    deleteWaitlistEntry(where: { id: $id }) {
      id
    }
  }
`

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

export function WaitlistClient() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)

  const [newEntry, setNewEntry] = useState({
    clientName: '',
    clientPhone: '',
    serviceId: '',
    stylistIds: [] as string[],
    preferredTimeRange: '',
    notes: '',
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [entriesData, servicesData, stylistsData] = await Promise.all([
        request('/api/graphql', GET_WAITLIST_ENTRIES),
        request('/api/graphql', GET_SERVICES),
        request('/api/graphql', GET_STYLISTS),
      ])

      setEntries((entriesData as any).waitlistEntries || [])
      setServices((servicesData as any).services || [])
      setStylists((stylistsData as any).stylists || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAddEntry = async () => {
    if (!newEntry.clientName || !newEntry.serviceId) return

    try {
      const data: any = {
        service: { connect: { id: newEntry.serviceId } },
        preferredTimeRange: newEntry.preferredTimeRange || null,
        notes: newEntry.notes || null,
        isActive: true,
      }

      if (newEntry.stylistIds.length > 0) {
        data.preferredStylists = {
          connect: newEntry.stylistIds.map((id) => ({ id })),
        }
      }

      await request('/api/graphql', CREATE_WAITLIST_ENTRY, { data })

      setNewEntry({
        clientName: '',
        clientPhone: '',
        serviceId: '',
        stylistIds: [],
        preferredTimeRange: '',
        notes: '',
      })
      setAddDialogOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error creating waitlist entry:', err)
    }
  }

  const handleNotify = async (entry: WaitlistEntry) => {
    try {
      await request('/api/graphql', UPDATE_WAITLIST_ENTRY, {
        id: entry.id,
        data: { notifiedAt: new Date().toISOString() },
      })
      fetchData()
    } catch (err) {
      console.error('Error notifying:', err)
    }
  }

  const handleConvertToAppointment = (entry: WaitlistEntry) => {
    const serviceParam = entry.service?.id ? `service=${entry.service.id}` : ''
    const stylistParam = entry.preferredStylists?.[0]?.id
      ? `&stylist=${entry.preferredStylists[0].id}`
      : ''
    window.location.href = `/book?${serviceParam}${stylistParam}`
  }

  const handleRemove = async (entry: WaitlistEntry) => {
    if (!confirm('Remove this entry from the waitlist?')) return

    try {
      await request('/api/graphql', UPDATE_WAITLIST_ENTRY, {
        id: entry.id,
        data: { isActive: false },
      })
      fetchData()
    } catch (err) {
      console.error('Error removing entry:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{entries.length} waiting</Badge>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
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
                        {service.name} ({service.baseDuration}min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preferred Stylist</Label>
                <Select
                  value={newEntry.stylistIds[0] || ''}
                  onValueChange={(v) =>
                    setNewEntry({ ...newEntry, stylistIds: v ? [v] : [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any available" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any available</SelectItem>
                    {stylists.map((stylist) => (
                      <SelectItem key={stylist.id} value={stylist.id}>
                        {stylist.user.name} ({stylist.tier})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="">Anytime</SelectItem>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEntry}>Add to Waitlist</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
                          {entry.client?.name || 'Walk-in'}
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
                              .map((s) => s.user.name)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      {entry.notes && (
                        <div className="text-sm text-muted-foreground italic">
                          "{entry.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!entry.notifiedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNotify(entry)}
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
                      onClick={() => handleRemove(entry)}
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
