import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Layers, Scissors, ShieldCheck, Star, UsersRound } from 'lucide-react';
import { getServiceDetail, savePricingTiers } from '../actions/serviceDetail';
import { ActionForm } from '../../components/ActionForm';
import { Avatar, Chip, Fact, fieldLabelClass, inputClass, labelize, MetricStrip, PageHeader, Panel, PillLink, PlatformPage, TitleStatus, Track, usd } from '../../components/salon-ui';
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
        icon={Scissors}
        title={service.name}
        status={<TitleStatus tone={service.status === 'active' ? 'emerald' : 'zinc'}>{service.status === 'active' ? 'Bookable' : labelize(service.status) || 'Inactive'}</TitleStatus>}
        meta={<><span>{usd(service.price)}</span><span>{service.baseDuration} min</span>{service.category?.name ? <span>{service.category.name}</span> : null}</>}
        actions={<Track><PillLink href={`/dashboard/platform/catalog#management-service`} variant="quiet">Edit service</PillLink><PillLink href={`/services/${service.id}`} variant="quiet">Storefront</PillLink></Track>}
      />
      {activeSpecialists.length === 0 || service.status !== 'active' ? (
        <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{service.status !== 'active' ? 'Not bookable: the service is inactive.' : 'Not bookable: no active specialist offers it.'}</p>
      ) : null}
      <MetricStrip items={[
        { label: 'Upcoming bookings', value: upcomingCount, tone: upcomingCount ? 'blue' : undefined },
        { label: 'Completed visits', value: completedCount },
        { label: 'Specialists', value: activeSpecialists.length },
        { label: 'Rating', value: average ? `${average.toFixed(1)} · ${approved.length}` : '—' },
      ]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Booking rules" icon={ShieldCheck}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Deposit">{service.depositRequired ? usd(service.depositAmount) : 'None'}</Fact>
              <Fact label="Consultation">{service.requiresConsultation ? 'Before booking' : 'Not required'}</Fact>
              <Fact label="Patch test">{service.requiresPatchTest ? 'Required' : 'Not required'}</Fact>
              <Fact label="Resources">{service.requiredResources.map((resource) => resource.name).join(', ') || 'None'}</Fact>
            </dl>
          </Panel>

          <Panel title="Price by stylist level" icon={Layers}>
            <ActionForm action={savePricingTiers} submitLabel="Save prices">
              <input type="hidden" name="id" value={service.id} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {levels.map((level) => (
                  <label key={level.key} className={fieldLabelClass}>{level.label}
                    <span className="relative block"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><input name={`tier.${level.key}`} type="number" min="0" step="0.01" inputMode="decimal" defaultValue={typeof service.pricingTier?.[level.key] === 'number' ? (service.pricingTier[level.key] / 100).toFixed(2) : ''} className={`${inputClass} pl-7`} /></span>
                  </label>
                ))}
              </div>
            </ActionForm>
          </Panel>

          <Panel title="Upcoming bookings" icon={CalendarDays} padded={false}>
            {upcoming.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No upcoming bookings.</p> : (
              <ul className="divide-y">
                {upcoming.map((appointment) => (
                  <li key={appointment.id}><Link href={`/dashboard/platform/appointments/${appointment.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40 md:px-5"><span className="truncate font-medium">{appointment.client?.displayName || 'Client'} · {appointment.stylist?.user?.name || 'Unassigned'}</span><span className="shrink-0 tabular-nums text-muted-foreground">{new Date(appointment.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: appointment.location?.timezone || timeZone })}</span></Link></li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Reviews" icon={Star} padded={false}>
            {service.reviews.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No reviews yet.</p> : (
              <ul className="divide-y">
                {service.reviews.slice(0, 8).map((review) => (
                  <li key={review.id} className="px-4 py-3 text-sm md:px-5"><span className="flex items-center gap-2 font-medium">{'★'.repeat(review.rating)}<TitleStatus tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting approval'}</TitleStatus></span>{review.comment ? <p className="mt-1 text-muted-foreground">{review.comment}</p> : null}</li>
                ))}
              </ul>
            )}
            <div className="border-t px-4 py-3 md:px-5"><Link href="/dashboard/platform/reviews" className="text-sm font-medium underline-offset-4 hover:underline">Moderate reviews</Link></div>
          </Panel>
        </div>

        <aside className="grid content-start gap-6">
          {image ? <img src={image} alt="" className="aspect-[4/3] w-full rounded-2xl border object-cover" /> : null}
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
