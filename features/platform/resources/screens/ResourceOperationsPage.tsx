import type { ComponentType } from 'react';
import Link from 'next/link';
import { Armchair, CalendarClock, MapPin, PackageCheck, Scissors, ShieldAlert } from 'lucide-react';
import { getResourceOperations, PlatformResource, setResourceActive } from '../actions/resources';

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

const tabs = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
] as const;

const typeLabels: Record<string, string> = {
  station: 'Station',
  room: 'Room',
  shampoo_bowl: 'Shampoo bowl',
  equipment: 'Equipment',
  color_bar: 'Color bar',
  other: 'Other',
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Unscheduled';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function ResourceOperationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = resolvedSearchParams.status || 'active';
  const { resources, counts } = await getResourceOperations(activeStatus);

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <Armchair className="h-3.5 w-3.5" />
                Rooms & equipment
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Resources</h1>

            </div>

          </div>
        </header>

        {counts.uncoveredServices > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">{counts.uncoveredServices} active service{counts.uncoveredServices === 1 ? '' : 's'} missing resource requirements</div>
                <p className="mt-1 text-amber-800/80">
                  These services can still be booked, but availability cannot yet protect chairs, rooms, or equipment from double-booking.
                </p>
              </div>
            </div>
          </section>
        )}

        <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-muted p-1 shadow-inner" aria-label="Resource filters">
          {tabs.map((tab) => {
            const isActive = activeStatus === tab.value;
            const href = tab.value === 'active' ? '/dashboard/platform/resources' : `/dashboard/platform/resources?status=${tab.value}`;
            const count = counts[tab.value as keyof typeof counts] ?? 0;
            return (
              <Link
                key={tab.value}
                href={href}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label} <span className="ml-1 opacity-70">{count}</span>
              </Link>
            );
          })}
        </nav>

        {resources.length === 0 ? (
          <section className="rounded-2xl border bg-background p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Armchair className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No resources in this view</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Create SalonResource records for chairs, rooms, stations, and equipment to unlock resource-aware booking.
            </p>
          </section>
        ) : (
          <section className="grid min-w-0 gap-4">
            {resources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}


function ResourceCard({ resource }: { resource: PlatformResource }) {
  const serviceNames = resource.services.map((service) => service.name).filter(Boolean).join(', ') || 'No services assigned';
  const statusLabel = resource.isActive ? 'Active' : 'Inactive';

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${resource.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-300 bg-zinc-100 text-zinc-700'}`}>
              {statusLabel}
            </span>
            <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {typeLabels[resource.type || ''] || resource.type || 'Resource'}
            </span>
            <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Capacity {resource.capacity || 1}
            </span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">{resource.name || 'Unnamed resource'}</h2>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <Info icon={MapPin} label="Location" value={resource.location?.name || 'No location'} subvalue={resource.location?.city || undefined} />
            <Info icon={Scissors} label="Services" value={serviceNames} />
            <Info icon={CalendarClock} label="Active queue" value={`${resource.appointments.length} appointment${resource.appointments.length === 1 ? '' : 's'}`} />
          </div>

          {resource.notes && <p className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{resource.notes}</p>}
        </div>

        <aside className="min-w-0 max-w-full lg:w-80">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="mb-3 text-sm font-semibold">Upcoming resource holds</div>
            {resource.appointments.length ? (
              <div className="grid gap-3">
                {resource.appointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="rounded-xl border bg-background p-3 text-sm">
                    <div className="font-medium">{formatDateTime(appointment.startTime)}</div>
                    <div className="mt-1 text-muted-foreground">
                      {appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'Service'} · {appointment.stylist?.user?.name || 'Unassigned'}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{appointment.client?.user?.name || 'Unnamed client'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active appointments currently holding this resource.</p>
            )}

            <form action={setResourceActive} className="mt-4">
              <input type="hidden" name="id" value={resource.id} />
              <input type="hidden" name="revision" value={resource.revision} />
              <input type="hidden" name="isActive" value={resource.isActive ? 'false' : 'true'} />
              <button type="submit" className="inline-flex w-full items-center justify-center rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                {resource.isActive ? 'Deactivate resource' : 'Reactivate resource'}
              </button>
            </form>

            <Link
              href={`/dashboard/salon-resources/${resource.id}`}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Open resource record
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  subvalue,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{label}</div>
        <div className="truncate font-medium text-foreground">{value}</div>
        {subvalue && <div className="truncate text-xs text-muted-foreground">{subvalue}</div>}
      </div>
    </div>
  );
}

export default ResourceOperationsPage;
