import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, CalendarDays, Layers, Pencil, ShieldCheck, Star, UsersRound } from 'lucide-react';
import { getServiceDetail, savePricingTiers } from '../actions/serviceDetail';
import { ActionForm } from '../../components/ActionForm';
import { Avatar, Chip, DataTable, Fact, fieldLabelClass, inputClass, labelize, Notice, PageHeader, Panel, PillLink, PlatformPage, Td, TitleStatus, usd } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

const levels = [{ key: 'junior', label: 'Stylist' }, { key: 'senior', label: 'Senior' }, { key: 'master', label: 'Master' }, { key: 'celebrity', label: 'Celebrity' }];

export async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, timeZone] = await Promise.all([getServiceDetail(id), getSalonTimezone()]);
  if (!data?.service) notFound();
  const { service, upcoming, upcomingCount, completedCount } = data;
  const approved = service.reviews.filter((review) => review.isApproved);
  const average = approved.length ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length : null;
  const image = service.image?.image?.url || service.image?.imagePath || '';
  const activeSpecialists = service.specialists.filter((stylist) => stylist.status !== 'inactive');

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Services & catalog', href: '/platform/catalog' }, { type: 'page', label: service.name }]}>
      <PageHeader
        title={service.name}
        status={<TitleStatus tone={service.status === 'active' && activeSpecialists.length ? 'emerald' : service.status === 'active' ? 'amber' : 'zinc'}>{service.status !== 'active' ? labelize(service.status) || 'Inactive' : activeSpecialists.length ? 'Bookable' : 'No specialist'}</TitleStatus>}
        meta={<>{service.category?.name ? <span>{service.category.name}</span> : null}<span>{upcomingCount} upcoming</span><span>{completedCount} completed</span>{average ? <span>Rated {average.toFixed(1)} from {approved.length}</span> : null}</>}
        actions={<>
          <Link href={`/services/${service.id}`} className="inline-flex h-8 items-center gap-1 px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View on storefront<ArrowUpRight className="size-3.5" /></Link>
          <PillLink href={`/dashboard/platform/catalog#management-service`} variant="raised"><Pencil />Edit service</PillLink>
        </>}
      />
      {activeSpecialists.length === 0 || service.status !== 'active' ? (
        <Notice title={service.status !== 'active' ? 'Not bookable: the service is inactive' : 'Not bookable: no active specialist offers it'} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Booking rules and price" icon={ShieldCheck}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Price">{usd(service.price)}</Fact>
              <Fact label="Duration">{service.baseDuration} min</Fact>
              <Fact label="Deposit">{service.depositRequired ? usd(service.depositAmount) : 'None'}</Fact>
              <Fact label="Specialists">{activeSpecialists.length}</Fact>
              <Fact label="Consultation">{service.requiresConsultation ? 'Before booking' : 'Not required'}</Fact>
              <Fact label="Patch test">{service.requiresPatchTest ? 'Required' : 'Not required'}</Fact>
              <div className="col-span-2 min-w-0"><dt className="text-xs text-muted-foreground">Resources</dt><dd className="mt-0.5 text-sm font-medium">{service.requiredResources.map((resource) => resource.name).join(', ') || 'None'}</dd></div>
            </dl>
          </Panel>

          <Panel title="Price by stylist level" icon={Layers}>
            <ActionForm action={savePricingTiers} submitLabel="Save prices">
              <input type="hidden" name="id" value={service.id} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {levels.map((level) => (
                  <label key={level.key} className={fieldLabelClass}>{level.label}
                    <span className="relative block"><span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><input name={`tier.${level.key}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder={(service.price / 100).toFixed(2)} defaultValue={typeof service.pricingTier?.[level.key] === 'number' ? (service.pricingTier[level.key] / 100).toFixed(2) : ''} className={`${inputClass} pl-6 tabular-nums`} /></span>
                  </label>
                ))}
              </div>
            </ActionForm>
          </Panel>

          <section aria-labelledby="upcoming-bookings" className="grid gap-2">
            <h2 id="upcoming-bookings" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-3.5 text-muted-foreground" />Upcoming bookings</h2>
            <DataTable label="Upcoming bookings" head={[{ label: 'When' }, { label: 'Client' }, { label: 'Stylist' }]}>
              {upcoming.length === 0 ? <tr><Td colSpan={3} className="py-4 text-muted-foreground">No upcoming bookings.</Td></tr> : upcoming.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-muted/30">
                  <Td className="whitespace-nowrap"><Link href={`/dashboard/platform/appointments/${appointment.id}`} className="font-medium tabular-nums underline-offset-4 hover:underline">{new Date(appointment.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: appointment.location?.timezone || timeZone })}</Link></Td>
                  <Td>{appointment.client?.displayName || 'Client'}</Td>
                  <Td className="text-muted-foreground">{appointment.stylist?.user?.name || 'Unassigned'}</Td>
                </tr>
              ))}
            </DataTable>
          </section>

          <Panel title="Reviews" icon={Star} padded={false}>
            {service.reviews.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No reviews yet.</p> : (
              <ul className="divide-y">
                {service.reviews.slice(0, 8).map((review) => (
                  <li key={review.id} className="px-4 py-3 text-sm md:px-5"><span className="flex items-center gap-2 font-medium"><span className="tabular-nums">{review.rating} / 5</span><TitleStatus tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting approval'}</TitleStatus></span>{review.comment ? <p className="mt-1 text-muted-foreground">{review.comment}</p> : null}</li>
                ))}
              </ul>
            )}
            <div className="border-t px-4 py-3 md:px-5"><Link href="/dashboard/platform/reviews" className="text-sm font-medium underline-offset-4 hover:underline">Moderate reviews</Link></div>
          </Panel>
        </div>

        <aside className="grid content-start gap-6">
          {image ? <img src={image} alt="" className="aspect-[4/3] w-full rounded-[6px] border object-cover" /> : null}
          <Panel title="Specialists" icon={UsersRound} padded={false}>
            {service.specialists.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No specialists assigned.</p> : (
              <ul className="divide-y">
                {service.specialists.map((stylist) => (
                  <li key={stylist.id}><Link href={`/dashboard/platform/staff/${stylist.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40 md:px-5"><Avatar name={stylist.user?.name} className="size-8 text-[11px]" /><span className="min-w-0"><span className="block truncate font-medium">{stylist.user?.name || 'Stylist'}</span><span className="block text-xs text-muted-foreground">{[labelize(stylist.tier), labelize(stylist.role)].filter(Boolean).join(' · ')}</span></span>{stylist.status !== 'active' ? <Chip>{labelize(stylist.status)}</Chip> : null}</Link></li>
                ))}
              </ul>
            )}
          </Panel>
          {service.description ? <Panel title="Description"><p className="whitespace-pre-line text-sm text-muted-foreground">{service.description}</p></Panel> : null}
        </aside>
      </div>
    </PlatformPage>
  );
}

export default ServiceDetailPage;
