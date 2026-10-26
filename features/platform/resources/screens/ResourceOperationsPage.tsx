import { Armchair, ArrowUpRight, Bath, Box, DoorOpen, Palette, Plus, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import { getResourceOperations, PlatformResource, setResourceActive } from '../actions/resources';
import { appointmentContact } from '../../lib/appointmentContact';
import { DataTable, EmptyState, labelize, Notice, PageHeader, pillClass, PillLink, PlatformPage, SegmentTabs, StatusCell, Td, TitleStatus } from '../../components/salon-ui';

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
        title="Resources"
        status={counts.uncoveredServices > 0 ? <TitleStatus tone="amber">{counts.uncoveredServices} services unprotected</TitleStatus> : null}
        meta={resources.length ? <span>{held} of {resources.length} held by upcoming bookings</span> : null}
        actions={<PillLink href="/dashboard/platform/administration#management-resource" variant="primary"><Plus />Add resource</PillLink>}
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
        <EmptyState icon={Armchair} title="No resources in this view" action={<PillLink href="/dashboard/platform/administration#management-resource">Add resource</PillLink>} />
      ) : (
        <DataTable label="Resource availability" head={[{ label: 'Resource' }, { label: 'Location', className: 'hidden md:table-cell' }, { label: 'Capacity', className: 'hidden sm:table-cell text-right' }, { label: 'Availability' }, { label: 'Next hold', className: 'hidden lg:table-cell' }, { label: 'Services', className: 'hidden xl:table-cell' }, { label: 'Actions', className: 'text-right' }]}>
          {resources.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
        </DataTable>
      )}
    </PlatformPage>
  );
}

function ResourceRow({ resource }: { resource: PlatformResource }) {
  const meta = typeMeta[resource.type || ''] || { label: labelize(resource.type) || 'Resource', icon: Box };
  const Icon = meta.icon;
  const serviceNames = resource.services.map((service) => service.name).filter(Boolean);
  const next = resource.appointments[0];

  return (
    <tr className="hover:bg-muted/20">
      <Td>
        <span className="flex items-center gap-2"><Icon className="size-3.5 shrink-0 text-muted-foreground" /><span className="font-medium">{resource.name || 'Unnamed resource'}</span></span>
        <span className="block text-xs text-muted-foreground">{meta.label}<span className="md:hidden"> · {resource.location?.name || 'No location'}</span></span>
      </Td>
      <Td className="hidden text-muted-foreground md:table-cell">{resource.location?.name || 'No location'}</Td>
      <Td className="hidden text-right tabular-nums sm:table-cell">{resource.capacity || 1}</Td>
      <Td>
        <StatusCell tone={!resource.isActive ? 'zinc' : resource.appointments.length ? 'blue' : 'emerald'}>{!resource.isActive ? 'Inactive' : resource.appointments.length ? `${resource.appointments.length} booked` : 'Free'}</StatusCell>
        {next ? <span className="block text-xs tabular-nums text-muted-foreground lg:hidden">Next {formatDateTime(next.startTime, next.location?.timezone)}</span> : null}
      </Td>
      <Td className="hidden lg:table-cell">
        {next ? (
          <>
            <span className="block whitespace-nowrap tabular-nums">{formatDateTime(next.startTime, next.location?.timezone)}</span>
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground">{next.client?.displayName || appointmentContact({ metadata: next.metadata }).name} · {next.stylist?.user?.name || 'Unassigned'}</span>
          </>
        ) : <span className="text-muted-foreground">None</span>}
      </Td>
      <Td className="hidden max-w-[16rem] text-muted-foreground xl:table-cell">{serviceNames.length ? <span title={serviceNames.join(', ')} className="line-clamp-2">{serviceNames.join(', ')}</span> : <span className="text-amber-700 dark:text-amber-400">No services</span>}</Td>
      <Td>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <PillLink href={`/dashboard/salon-resources/${resource.id}`} size="sm" variant="raised">Open<ArrowUpRight /></PillLink>
          <form action={setResourceActive}>
            <input type="hidden" name="id" value={resource.id} />
            <input type="hidden" name="revision" value={resource.revision} />
            <input type="hidden" name="isActive" value={resource.isActive ? 'false' : 'true'} />
            <button type="submit" className={pillClass(resource.isActive ? 'quiet' : 'raised', 'sm')}>{resource.isActive ? 'Deactivate' : 'Reactivate'}</button>
          </form>
        </div>
      </Td>
    </tr>
  );
}

export default ResourceOperationsPage;
