import { Armchair, ArrowUpRight, Bath, Box, DoorOpen, Palette, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import { getResourceOperations, PlatformResource, setResourceActive } from '../actions/resources';
import { appointmentContact } from '../../lib/appointmentContact';
import { Chip, EmptyState, labelize, MetricStrip, Notice, PageHeader, pillClass, PillLink, PlatformPage, SegmentTabs, TitleStatus, Track, trackClass } from '../../components/salon-ui';

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

const tabs = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
] as const;

const typeMeta: Record<string, { label: string; icon: ComponentType<{ className?: string }> }> = {
  station: { label: 'Station', icon: Armchair },
  room: { label: 'Room', icon: DoorOpen },
  shampoo_bowl: { label: 'Shampoo bowl', icon: Bath },
  equipment: { label: 'Equipment', icon: Wrench },
  color_bar: { label: 'Color bar', icon: Palette },
  other: { label: 'Other', icon: Box },
};

function formatDateTime(value?: string | null, timeZone?: string | null) {
  if (!value) return 'Unscheduled';
  return new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined });
}

export async function ResourceOperationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = resolvedSearchParams.status || 'active';
  const { resources, counts } = await getResourceOperations(activeStatus);
  const held = resources.filter((resource) => resource.appointments.length > 0).length;

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Resources' }]}>
      <PageHeader
        icon={Armchair}
        title="Resources"
        status={<TitleStatus tone={counts.uncoveredServices > 0 ? 'amber' : 'emerald'}>{counts.uncoveredServices > 0 ? `${counts.uncoveredServices} services unprotected` : 'All services covered'}</TitleStatus>}
        actions={<Track><PillLink href="/dashboard/platform/administration#management-resource">Add resource<ArrowUpRight /></PillLink></Track>}
      />

      <MetricStrip
        items={[
          { label: 'Active', value: counts.active, tone: 'emerald' },
          { label: 'Inactive', value: counts.inactive, tone: 'zinc' },
          { label: 'Held by bookings', value: held, tone: 'blue' },
        ]}
      />

      {counts.uncoveredServices > 0 ? (
        <Notice title={`${counts.uncoveredServices} active service${counts.uncoveredServices === 1 ? '' : 's'} without resource requirements`}>
          Booking can&apos;t protect chairs, rooms, or equipment for these services.
        </Notice>
      ) : null}

      <SegmentTabs
        label="Resource filters"
        active={activeStatus}
        tabs={tabs.map((tab) => ({
          value: tab.value,
          label: tab.label,
          href: tab.value === 'active' ? '/dashboard/platform/resources' : `/dashboard/platform/resources?status=${tab.value}`,
          count: counts[tab.value as keyof typeof counts] ?? 0,
        }))}
      />

      {resources.length === 0 ? (
        <EmptyState icon={Armchair} title="No resources in this view" action={<Track><PillLink href="/dashboard/platform/administration#management-resource">Add resource</PillLink></Track>} />
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => <ResourceTile key={resource.id} resource={resource} />)}
        </div>
      )}
    </PlatformPage>
  );
}

function ResourceTile({ resource }: { resource: PlatformResource }) {
  const meta = typeMeta[resource.type || ''] || { label: labelize(resource.type) || 'Resource', icon: Box };
  const Icon = meta.icon;
  const serviceNames = resource.services.map((service) => service.name).filter(Boolean);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-start gap-3 p-4 md:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="min-w-0 truncate text-base font-semibold">{resource.name || 'Unnamed resource'}</h2>
            <TitleStatus tone={!resource.isActive ? 'zinc' : resource.appointments.length ? 'blue' : 'emerald'}>{!resource.isActive ? 'Inactive' : resource.appointments.length ? `${resource.appointments.length} booked` : 'Free'}</TitleStatus>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta.label} · capacity {resource.capacity || 1} · {resource.location?.name || 'No location'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 md:px-5">
        {serviceNames.length ? serviceNames.slice(0, 4).map((name) => <Chip key={name}>{name}</Chip>) : <Chip tone="amber">No services assigned</Chip>}
        {serviceNames.length > 4 ? <Chip>+{serviceNames.length - 4}</Chip> : null}
      </div>
      {resource.notes ? <p className="mx-4 mt-3 text-sm text-muted-foreground md:mx-5">{resource.notes}</p> : null}

      <div className="mt-4 border-t bg-muted/20 px-4 py-3 md:px-5">
        <div className="text-xs font-medium text-muted-foreground">Upcoming holds</div>
        {resource.appointments.length ? (
          <ul className="mt-2 grid gap-2">
            {resource.appointments.slice(0, 3).map((appointment) => (
              <li key={appointment.id} className="min-w-0 text-sm">
                <span className="font-medium tabular-nums">{formatDateTime(appointment.startTime, appointment.location?.timezone)}</span>
                <span className="block truncate text-xs text-muted-foreground">{appointment.client?.displayName || appointmentContact({ metadata: appointment.metadata }).name} · {appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'Service'} · {appointment.stylist?.user?.name || 'Unassigned'}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-sm text-muted-foreground">None</p>}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 md:px-5">
        <form action={setResourceActive} className={trackClass}>
          <input type="hidden" name="id" value={resource.id} />
          <input type="hidden" name="revision" value={resource.revision} />
          <input type="hidden" name="isActive" value={resource.isActive ? 'false' : 'true'} />
          <button type="submit" className={pillClass(resource.isActive ? 'raised' : 'primary', 'sm')}>{resource.isActive ? 'Deactivate' : 'Reactivate'}</button>
        </form>
        <Track><PillLink href={`/dashboard/salon-resources/${resource.id}`} size="sm" variant="quiet">Record<ArrowUpRight /></PillLink></Track>
      </div>
    </article>
  );
}

export default ResourceOperationsPage;
