import { CalendarPlus, ContactRound } from 'lucide-react';
import { getSalonManagementWorkspace, getSalonWorkspace, type SalonManagementData } from '../../workspaces/actions/workspaces';
import { getSalonTimezone } from '../../lib/salonTimezone';
import { getClientDirectoryVisits } from '../lib/clientDirectory';
import { ErrorState, PageHeader, PillLink, PlatformPage, TitleStatus, Track } from '../../components/salon-ui';
import { ClientDirectory, type DirectoryRow } from './ClientDirectory';
import { RetryClientsButton } from './RetryClientsButton';

function day(value: string | null | undefined, timeZone?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timeZone || undefined }) : null;
}
function slot(value: string, timeZone?: string | null) {
  return new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined });
}

/** The front desk's client book: find a client by name or phone, then open, book or edit from the row. */
export async function ClientsListPage() {
  let management: SalonManagementData | null = null;
  try {
    management = await getSalonManagementWorkspace('client');
  } catch {
    management = null;
  }
  const [workspace, timeZone, visits] = await Promise.all([
    getSalonWorkspace('clients').catch(() => null),
    getSalonTimezone(),
    management ? getClientDirectoryVisits((management.records || []).map((record) => record.id)) : Promise.resolve(null),
  ]);

  const rows: DirectoryRow[] = (management?.records || []).map((record) => {
    const visit = visits?.[record.id];
    return {
      id: record.id,
      name: record.user?.name || record.guestName || record.name || 'Unnamed client',
      email: record.user?.email || record.guestEmail || '',
      phone: record.user?.phone || record.guestPhone || '',
      account: Boolean(record.user),
      homeLocationId: record.homeLocation?.id || '',
      visits: visits ? visit?.totalVisits ?? 0 : null,
      lastVisit: visits ? day(visit?.lastVisit, timeZone) : null,
      next: visit?.next ? { id: visit.next.id, label: slot(visit.next.startTime, visit.next.timezone || timeZone) } : null,
    };
  });

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Clients' }]}>
      <PageHeader
        icon={ContactRound}
        title="Clients"
        status={workspace && workspace.attentionCount > 0 ? <TitleStatus tone="amber">{workspace.attentionLabel || `${workspace.attentionCount} need attention`}</TitleStatus> : null}
        actions={<Track><PillLink href="/dashboard/platform/appointments/new" variant="quiet"><CalendarPlus />New appointment</PillLink></Track>}
      />
      {!management ? (
        <ErrorState id="clients-error" title="Clients couldn't be loaded" message="The client list could not be verified, so it is not shown as empty. Check your access or connection, then retry." action={<RetryClientsButton />} />
      ) : (
        <ClientDirectory rows={rows} visitsKnown={visits !== null} locations={(management.locations || []).map((location) => ({ id: location.id, name: `${location.name}${location.isActive === false ? ' · Inactive' : ''}` }))} />
      )}
    </PlatformPage>
  );
}

export default ClientsListPage;
