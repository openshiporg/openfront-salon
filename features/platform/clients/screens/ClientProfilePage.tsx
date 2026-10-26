import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CalendarPlus, ChevronDown, ContactRound, FlaskConical, NotebookPen, Scissors, ShieldAlert } from 'lucide-react';
import { getClientProfile } from '../actions/clientProfile';
import { appointmentLabel, appointmentTone, EmptyState, Fact, PageHeader, Panel, PillLink, PlatformPage, StatusCell, Track, labelize, usd } from '../../components/salon-ui';
import { cn } from '@/lib/utils';
import { stackBodyClass, stackCellClass, stackHeadClass, stackRowClass, stackTableClass, stackThClass } from '../../appointments/lib/stackTable';
import { CareProfileForm, ClientNoteForm, ColorFormulaForm } from './ClientCareForms';
import { getSalonTimezone } from '../../lib/salonTimezone';

function when(value?: string | null, timeZone?: string | null) {
  return value ? new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined }) : '—';
}
function day(value?: string | null, timeZone?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timeZone || undefined }) : '—';
}

export async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ client, notes, stylists }, tz] = await Promise.all([getClientProfile(id), getSalonTimezone()]);
  if (!client) notFound();

  const name = client.displayName || client.user?.name || 'Client';
  const email = client.user?.email || client.guestEmail || '';
  const phone = client.user?.phone || client.guestPhone || '';
  const now = Date.now();
  const upcoming = client.appointments.filter((item) => item.startTime && new Date(item.startTime).getTime() >= now && ['pending', 'confirmed', 'in_progress'].includes(item.status || '')).reverse();
  const history = client.appointments.filter((item) => !upcoming.includes(item));
  // Visit stats come from completed appointments, so they always agree with the history below.
  const completed = client.appointments.filter((item) => item.status === 'completed' && item.startTime).map((item) => item.startTime!).sort();
  const visits = client.appointments.length < 50 ? completed.length : Math.max(completed.length, client.totalVisits || 0);
  const firstVisit = completed[0] || client.firstVisit;
  const lastVisit = completed[completed.length - 1] || client.lastVisit;
  const careVisible = notes !== null;
  const bookHref = `/dashboard/platform/appointments/new?client=${client.id}${client.preferredStylist?.id ? `&stylist=${client.preferredStylist.id}` : ''}`;

  const careAlerts = careVisible ? [client.allergies ? `Allergies: ${client.allergies}` : '', client.skinSensitivities ? `Sensitivities: ${client.skinSensitivities}` : ''].filter(Boolean) : [];
  const nextVisit = upcoming[0];

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Clients', href: '/platform/clients' }, { type: 'page', label: name }]}>
      <PageHeader
        icon={ContactRound}
        title={name}
        meta={<>
          <span>{client.user ? 'Account' : 'Guest'}</span>
          {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="tabular-nums text-foreground underline-offset-4 hover:underline">{phone}</a> : null}
          {email ? <span className="min-w-0 break-all">{email}</span> : null}
        </>}
        actions={<Track><PillLink href={bookHref} variant="primary"><CalendarPlus />Book again</PillLink></Track>}
      />

      {careAlerts.length ? (
        <section aria-label="Care alert" className="flex items-start gap-3 rounded-[6px] border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <dl className="grid min-w-0 gap-1">
            {client.allergies ? <div><dt className="inline font-semibold">Allergies: </dt><dd className="inline whitespace-pre-line">{client.allergies}</dd></div> : null}
            {client.skinSensitivities ? <div><dt className="inline font-semibold">Sensitivities: </dt><dd className="inline whitespace-pre-line">{client.skinSensitivities}</dd></div> : null}
          </dl>
        </section>
      ) : null}

      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y py-2.5 text-sm">
        <Stat label="Visits" value={String(visits)} />
        <Stat label="Last visit" value={day(lastVisit, tz)} />
        <Stat label="Next" value={nextVisit ? when(nextVisit.startTime, nextVisit.location?.timezone || tz) : 'None booked'} href={nextVisit ? `/dashboard/platform/appointments/${nextVisit.id}` : undefined} />
        <Stat label="Lifetime value" value={usd(client.lifetimeValue || 0)} />
        <Stat label="Preferred stylist" value={client.preferredStylist?.user?.name || '—'} />
      </dl>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-5">
          {careVisible ? (
            <>
              <Panel title="Color formulas" icon={FlaskConical} padded={false} actions={<span className="text-xs tabular-nums text-muted-foreground">{client.colorFormulas.length}</span>}>
                {client.colorFormulas.length ? (
                  <ul className="divide-y">
                    {client.colorFormulas.map((formula, index) => (
                      <li key={formula.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <h3 className="text-sm font-semibold">{formula.formulaName || 'Formula'}{index === 0 ? <span className="ml-2 text-xs font-medium text-muted-foreground">Latest</span> : null}</h3>
                          <span className="text-xs text-muted-foreground">{day(formula.createdAt, tz)}{formula.stylist?.user?.name ? ` · ${formula.stylist.user.name}` : ''}{formula.processingTime ? ` · ${formula.processingTime} min` : ''}</span>
                        </div>
                        {formula.products || formula.measurements || formula.result ? (
                          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                            {formula.products ? <Fact label="Products"><span className="whitespace-pre-line">{formula.products}</span></Fact> : null}
                            {formula.measurements ? <Fact label="Measurements"><span className="whitespace-pre-line">{formula.measurements}</span></Fact> : null}
                            {formula.result ? <Fact label="Result"><span className="whitespace-pre-line">{formula.result}</span></Fact> : null}
                          </dl>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-3 text-sm text-muted-foreground">No formulas recorded.</p>}
                <Disclosure label="New formula" className="border-t"><ColorFormulaForm clientId={client.id} stylists={stylists} /></Disclosure>
              </Panel>
              <Panel title="Care notes" icon={NotebookPen} padded={false} actions={<span className="text-xs tabular-nums text-muted-foreground">{notes.length}</span>}>
                {notes.length ? (
                  <ul className="divide-y">
                    {notes.map((note) => (
                      <li key={note.id} className="px-4 py-3 text-sm">
                        <p className="whitespace-pre-line">{note.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{day(note.createdAt, tz)}{note.author?.name ? ` · ${note.author.name}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-3 text-sm text-muted-foreground">No notes yet.</p>}
                <div className="border-t p-4"><ClientNoteForm clientId={client.id} /></div>
              </Panel>
            </>
          ) : null}
          <Panel title="Upcoming" icon={CalendarPlus} padded={false}>
            {upcoming.length ? <VisitList items={upcoming} /> : <p className="px-4 py-3 text-sm text-muted-foreground">No upcoming appointments.</p>}
          </Panel>
          <Panel title="Visit history" icon={Scissors} padded={false}>
            {history.length ? <VisitList items={history} /> : <p className="px-4 py-3 text-sm text-muted-foreground">No past visits.</p>}
          </Panel>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <Panel title="Profile" padded={false}>
            <dl className="grid gap-3 p-4">
              {careVisible ? (
                <>
                  <Fact label="Allergies">{client.allergies || 'None recorded'}</Fact>
                  <Fact label="Skin sensitivities">{client.skinSensitivities || 'None recorded'}</Fact>
                  <Fact label="Hair">{[labelize(client.hairType), labelize(client.hairTexture)].filter(Boolean).join(' · ') || '—'}</Fact>
                </>
              ) : null}
              <Fact label="Home location">{client.homeLocation?.name || '—'}</Fact>
              <Fact label="First visit">{day(firstVisit, tz)}</Fact>
              <Fact label="Marketing">{client.marketingConsent ? 'Opted in' : 'Not opted in'}</Fact>
              {careVisible && client.notes ? <Fact label="Profile notes"><span className="whitespace-pre-line">{client.notes}</span></Fact> : null}
            </dl>
            <Disclosure label="Edit profile" className="border-t">
              <CareProfileForm clientId={client.id} careVisible={careVisible} stylists={stylists} profile={{ allergies: client.allergies, skinSensitivities: client.skinSensitivities, hairType: client.hairType, hairTexture: client.hairTexture, notes: client.notes, preferredStylistId: client.preferredStylist?.id }} />
            </Disclosure>
          </Panel>
          <Link href="/dashboard/platform/clients" className="text-sm font-medium underline-offset-4 hover:underline">All clients</Link>
        </aside>
      </div>
    </PlatformPage>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{href ? <Link href={href} className="underline-offset-4 hover:underline">{value}</Link> : value}</dd>
    </div>
  );
}

/** A native disclosure with a flat summary row; the form stays out of the way until asked for. */
function Disclosure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group ${className || ''}`}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

function VisitList({ items }: { items: NonNullable<Awaited<ReturnType<typeof getClientProfile>>['client']>['appointments'] }) {
  if (!items.length) return <EmptyState icon={Scissors} title="No visits" />;
  return (
    <div className="lg:overflow-x-auto">
    <table className={stackTableClass} aria-label="Visits">
      <thead className={stackHeadClass}>
        <tr>
          {['When', 'Services', 'Stylist', 'Status'].map((label) => <th key={label} scope="col" className={stackThClass}>{label}</th>)}
          <th scope="col" className={cn(stackThClass, 'text-right')}>Paid</th>
        </tr>
      </thead>
      <tbody className={stackBodyClass}>
        {items.map((item) => {
          const status = item.status || '';
          return (
            <tr key={item.id} className={cn(stackRowClass, 'grid-cols-[minmax(0,1fr)_auto]')}>
              <td className={cn(stackCellClass, 'whitespace-nowrap text-xs text-muted-foreground lg:text-sm lg:text-foreground')}><Link href={`/dashboard/platform/appointments/${item.id}`} className="tabular-nums underline-offset-4 hover:underline">{when(item.startTime, item.location?.timezone)}</Link></td>
              <td className={cn(stackCellClass, 'col-start-1 truncate font-medium lg:max-w-60 lg:font-normal')}>{item.services.map((service) => service.name).filter(Boolean).join(', ') || 'Appointment'}<span className="font-normal text-muted-foreground lg:hidden"> · {item.stylist?.user?.name || 'Unassigned'}</span></td>
              <td className={cn(stackCellClass, 'hidden whitespace-nowrap lg:table-cell')}>{item.stylist?.user?.name || 'Unassigned'}</td>
              <td className={cn(stackCellClass, 'col-start-2 row-start-1')}><StatusCell tone={appointmentTone[status] || 'zinc'}>{appointmentLabel[status] || labelize(status)}</StatusCell></td>
              <td className={cn(stackCellClass, 'col-start-2 row-start-2 text-right tabular-nums')}>{item.payment?.totalAmount ? usd(item.payment.totalAmount) : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export default ClientProfilePage;
