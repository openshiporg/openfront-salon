import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarPlus, ContactRound, FlaskConical, NotebookPen, Scissors } from 'lucide-react';
import { getClientProfile } from '../actions/clientProfile';
import { appointmentLabel, appointmentTone, Avatar, EmptyState, Fact, MetricStrip, PageHeader, Panel, PillLink, PlatformPage, TitleStatus, Track, labelize, usd } from '../../components/salon-ui';
import { ClientNoteForm, ColorFormulaForm } from './ClientCareForms';

function when(value?: string | null, timeZone?: string | null) {
  return value ? new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined }) : '—';
}
function day(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, notes, stylists } = await getClientProfile(id);
  if (!client) notFound();

  const name = client.displayName || client.user?.name || 'Client';
  const email = client.user?.email || client.guestEmail || '';
  const phone = client.user?.phone || client.guestPhone || '';
  const now = Date.now();
  const upcoming = client.appointments.filter((item) => item.startTime && new Date(item.startTime).getTime() >= now && ['pending', 'confirmed', 'in_progress'].includes(item.status || '')).reverse();
  const history = client.appointments.filter((item) => !upcoming.includes(item));
  const careVisible = notes !== null;
  const bookHref = `/dashboard/platform/appointments/new?client=${client.id}${client.preferredStylist?.id ? `&stylist=${client.preferredStylist.id}` : ''}`;

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Clients', href: '/platform/clients' }, { type: 'page', label: name }]}>
      <PageHeader
        icon={ContactRound}
        title={name}
        status={<TitleStatus tone={client.user ? 'emerald' : 'zinc'}>{client.user ? 'Account' : 'Guest'}</TitleStatus>}
        meta={[email, phone].filter(Boolean).join(' · ') || null}
        actions={<Track><PillLink href={bookHref} variant="primary"><CalendarPlus />Book</PillLink></Track>}
      />

      <MetricStrip items={[
        { label: 'Visits', value: client.totalVisits || 0 },
        { label: 'Lifetime value', value: usd(client.lifetimeValue || 0) },
        { label: 'Last visit', value: day(client.lastVisit) },
        { label: 'Upcoming', value: upcoming.length, tone: upcoming.length ? 'blue' : undefined },
      ]} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Panel title="Upcoming" icon={CalendarPlus} padded={false}>
            {upcoming.length ? <VisitList items={upcoming} /> : <p className="p-5 text-sm text-muted-foreground">No upcoming appointments.</p>}
          </Panel>
          <Panel title="Visit history" icon={Scissors} padded={false}>
            {history.length ? <VisitList items={history} /> : <p className="p-5 text-sm text-muted-foreground">No past visits.</p>}
          </Panel>
          {careVisible ? (
            <>
              <Panel title="Color formulas" icon={FlaskConical}>
                <div className="grid gap-5">
                  {client.colorFormulas.length ? (
                    <ul className="grid gap-3">
                      {client.colorFormulas.map((formula) => (
                        <li key={formula.id} className="rounded-xl border p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold">{formula.formulaName || 'Formula'}</h3>
                            <span className="text-xs text-muted-foreground">{day(formula.createdAt)}{formula.stylist?.user?.name ? ` · ${formula.stylist.user.name}` : ''}{formula.processingTime ? ` · ${formula.processingTime} min` : ''}</span>
                          </div>
                          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                            {formula.products ? <Fact label="Products"><span className="whitespace-pre-line">{formula.products}</span></Fact> : null}
                            {formula.measurements ? <Fact label="Measurements"><span className="whitespace-pre-line">{formula.measurements}</span></Fact> : null}
                            {formula.result ? <Fact label="Result"><span className="whitespace-pre-line">{formula.result}</span></Fact> : null}
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No formulas recorded.</p>}
                  <details className="rounded-xl border p-3">
                    <summary className="cursor-pointer text-sm font-medium">New formula</summary>
                    <div className="mt-3"><ColorFormulaForm clientId={client.id} stylists={stylists} /></div>
                  </details>
                </div>
              </Panel>
              <Panel title="Care notes" icon={NotebookPen}>
                <div className="grid gap-5">
                  <ClientNoteForm clientId={client.id} />
                  {notes.length ? (
                    <ul className="divide-y rounded-xl border">
                      {notes.map((note) => (
                        <li key={note.id} className="p-3 text-sm">
                          <p className="whitespace-pre-line">{note.content}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{day(note.createdAt)}{note.author?.name ? ` · ${note.author.name}` : ''}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No notes yet.</p>}
                </div>
              </Panel>
            </>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          <Panel title="Profile">
            <dl className="grid gap-3">
              <Fact label="Preferred stylist">{client.preferredStylist?.user?.name || '—'}</Fact>
              <Fact label="Home location">{client.homeLocation?.name || '—'}</Fact>
              <Fact label="First visit">{day(client.firstVisit)}</Fact>
              <Fact label="Marketing">{client.marketingConsent ? 'Opted in' : 'Not opted in'}</Fact>
              {careVisible ? (
                <>
                  <Fact label="Allergies">{client.allergies || '—'}</Fact>
                  <Fact label="Skin sensitivities">{client.skinSensitivities || '—'}</Fact>
                  <Fact label="Hair">{[labelize(client.hairType), labelize(client.hairTexture)].filter(Boolean).join(' · ') || '—'}</Fact>
                  {client.notes ? <Fact label="Profile notes"><span className="whitespace-pre-line">{client.notes}</span></Fact> : null}
                </>
              ) : null}
            </dl>
          </Panel>
          <Link href="/dashboard/platform/clients" className="text-sm font-medium underline-offset-4 hover:underline">All clients</Link>
        </aside>
      </div>
    </PlatformPage>
  );
}

function VisitList({ items }: { items: NonNullable<Awaited<ReturnType<typeof getClientProfile>>['client']>['appointments'] }) {
  if (!items.length) return <EmptyState icon={Scissors} title="No visits" />;
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const status = item.status || '';
        return (
          <li key={item.id}>
            <Link href={`/dashboard/platform/appointments/${item.id}`} className="grid gap-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate text-sm font-medium">{item.services.map((service) => service.name).filter(Boolean).join(', ') || 'Appointment'}</span><TitleStatus tone={appointmentTone[status] || 'zinc'}>{appointmentLabel[status] || labelize(status)}</TitleStatus></span>
                <span className="block truncate text-xs text-muted-foreground">{when(item.startTime, item.location?.timezone)} · {item.stylist?.user?.name || 'Unassigned'}</span>
              </span>
              {item.payment?.totalAmount ? <span className="text-sm font-semibold tabular-nums">{usd(item.payment.totalAmount)}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default ClientProfilePage;
