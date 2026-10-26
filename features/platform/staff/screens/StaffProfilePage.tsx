import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, CalendarClock, CalendarDays, Star, UserRound } from 'lucide-react';
import { getStaffProfile } from '../actions/staffProfile';
import { appointmentLabel, appointmentTone, Avatar, Chip, DataTable, Fact, labelize, PageHeader, Panel, PillLink, PlatformPage, StatusCell, Td, TitleStatus, Track, usd } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const order = [1, 2, 3, 4, 5, 6, 0];
function clock(value?: string | null) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${hours >= 12 ? 'pm' : 'am'}`;
}

export async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, timeZone] = await Promise.all([getStaffProfile(id), getSalonTimezone()]);
  if (!data) notFound();
  const { stylist, upcoming, upcomingCount, completedCount, noShowCount, earnings } = data;
  const name = stylist.user?.name || 'Staff member';
  const photo = stylist.photo?.image?.url || stylist.photo?.imagePath || '';
  const weekly = stylist.schedules.filter((schedule) => schedule.type === 'recurring');
  const timeOff = stylist.schedules.filter((schedule) => schedule.type === 'time_off');
  const approved = stylist.reviews.filter((review) => review.isApproved);
  const average = approved.length ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length : null;
  const statusTone = stylist.status === 'active' ? 'emerald' : stylist.status === 'on_leave' ? 'amber' : 'zinc';

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Staff & locations', href: '/platform/administration' }, { type: 'page', label: name }]}>
      <PageHeader
        icon={UserRound}
        title={name}
        status={<TitleStatus tone={statusTone}>{labelize(stylist.status) || 'Active'}</TitleStatus>}
        meta={<>
          <span>{[[labelize(stylist.tier), labelize(stylist.role)?.toLowerCase()].filter(Boolean).join(' '), stylist.user?.email, stylist.user?.phone].filter(Boolean).join(' · ')}</span>
          <span>{upcomingCount} upcoming · {completedCount} completed{noShowCount ? ` · ${noShowCount} no-show${noShowCount === 1 ? '' : 's'}` : ''}{average ? ` · rated ${average.toFixed(1)} from ${approved.length}` : ''}</span>
        </>}
        actions={<Track><PillLink href="/dashboard/platform/administration#management-staff" variant="raised">Edit profile</PillLink><PillLink href="/dashboard/platform/schedules" variant="raised">Hours & time off</PillLink><PillLink href={`/dashboard/platform/appointments/new?stylist=${stylist.id}`} variant="primary">Book</PillLink></Track>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <section aria-labelledby="staff-upcoming" className="grid gap-2">
            <h2 id="staff-upcoming" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-3.5 text-muted-foreground" />Upcoming appointments</h2>
            <DataTable label="Upcoming appointments" head={[{ label: 'When' }, { label: 'Client' }, { label: 'Services', className: 'hidden md:table-cell' }, { label: 'Status' }]}>
              {upcoming.length === 0 ? <tr><Td colSpan={4} className="py-4 text-muted-foreground">No upcoming appointments.</Td></tr> : upcoming.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-muted/30">
                  <Td className="whitespace-nowrap"><Link href={`/dashboard/platform/appointments/${appointment.id}`} className="font-medium tabular-nums underline-offset-4 hover:underline">{new Date(appointment.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: appointment.location?.timezone || timeZone })}</Link></Td>
                  <Td>{appointment.client?.displayName || 'Client'}</Td>
                  <Td className="hidden text-muted-foreground md:table-cell">{appointment.services.map((service) => service.name).filter(Boolean).join(', ')}</Td>
                  <Td><StatusCell tone={appointmentTone[appointment.status] || 'zinc'}>{appointmentLabel[appointment.status] || labelize(appointment.status)}</StatusCell></Td>
                </tr>
              ))}
            </DataTable>
          </section>

          <Panel title="Weekly hours" icon={CalendarClock}>
            {weekly.length === 0 ? <p className="text-sm text-muted-foreground">No weekly hours. Online booking shows no times for {name}.</p> : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {order.map((day) => {
                  const blocks = weekly.filter((schedule) => schedule.dayOfWeek === day);
                  return <Fact key={day} label={days[day]}>{blocks.length ? blocks.map((block) => block.isAvailable === false ? 'Blocked' : `${clock(block.startTime)}–${clock(block.endTime)}`).join(', ') : 'Off'}</Fact>;
                })}
              </dl>
            )}
            {timeOff.length ? (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground">Upcoming time off</h3>
                <ul className="mt-2 flex flex-wrap gap-2">{[...new Map(timeOff.map((item) => [`${item.localDate}:${item.startTime}`, item])).values()].map((item) => <li key={item.id}><Chip tone="rose">{new Date(`${item.localDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}{item.startTime === '00:00' && item.endTime === '23:59' ? '' : ` ${clock(item.startTime)}–${clock(item.endTime)}`}{item.reason ? ` · ${item.reason}` : ''}</Chip></li>)}</ul>
              </div>
            ) : null}
          </Panel>

          {earnings ? (
            <Panel title="Earnings" icon={Banknote} actions={<Link href="/dashboard/platform/commissions" className="text-xs font-medium underline-offset-4 hover:underline">Commissions</Link>}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact label="Service sales">{usd(earnings.sales)}</Fact>
                <Fact label="Commission owed">{usd(earnings.commissionOwed)}</Fact>
                <Fact label="Card tips owed">{usd(earnings.tipsOwed)}</Fact>
                <Fact label="Paid out">{usd(earnings.commissionPaid)}</Fact>
              </dl>
            </Panel>
          ) : null}

          <Panel title="Reviews" icon={Star} padded={false}>
            {stylist.reviews.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No reviews yet.</p> : (
              <ul className="divide-y">{stylist.reviews.slice(0, 8).map((review) => <li key={review.id} className="px-4 py-3 text-sm md:px-5"><span className="flex items-center gap-2 font-medium"><span className="tabular-nums">{review.rating} / 5</span><TitleStatus tone={review.isApproved ? 'emerald' : 'amber'}>{review.isApproved ? 'Published' : 'Awaiting approval'}</TitleStatus></span>{review.comment ? <p className="mt-1 text-muted-foreground">{review.comment}</p> : null}</li>)}</ul>
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-6">
          <Panel title="Profile">
            <div className="flex items-center gap-3">{photo ? <img src={photo} alt="" className="size-14 rounded-full border object-cover" /> : <Avatar name={name} className="size-14 text-base" />}<div className="min-w-0 text-sm"><div className="truncate font-medium">{name}</div><div className="text-muted-foreground">{labelize(stylist.employmentType) || 'Employment not recorded'}</div></div></div>
            <dl className="mt-4 grid gap-3">
              <Fact label="Locations">{stylist.locations.map((location) => location.name).join(', ') || 'None'}</Fact>
              <Fact label="Hired">{stylist.hireDate ? new Date(stylist.hireDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone }) : '—'}</Fact>
            </dl>
            {stylist.bio ? <p className="mt-4 whitespace-pre-line border-t pt-4 text-sm text-muted-foreground">{stylist.bio}</p> : <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">No bio on the storefront.</p>}
          </Panel>
          <Panel title="Services offered" padded={false}>
            {stylist.specializations.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No services assigned.</p> : (
              <ul className="divide-y">{stylist.specializations.map((service) => <li key={service.id}><Link href={`/dashboard/platform/catalog/${service.id}`} className="block px-4 py-2.5 text-sm hover:bg-muted/40 md:px-5">{service.name}</Link></li>)}</ul>
            )}
          </Panel>
        </aside>
      </div>
    </PlatformPage>
  );
}

export default StaffProfilePage;
