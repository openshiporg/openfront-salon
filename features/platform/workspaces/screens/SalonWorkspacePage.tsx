import type { ComponentType } from 'react';
import { ArrowUpRight, Boxes, Building2, CalendarClock, CircleDollarSign, ContactRound, Gift, Link2, Megaphone, Scissors, ShieldCheck, Armchair } from 'lucide-react';
import { getSalonManagementWorkspace, getSalonWorkspace, SalonManagementKind, transitionWaitlistFromWorkspace, WorkspaceRecord, WorkspaceSection } from '../actions/workspaces';
import { SalonRecordManager } from './SalonRecordManager';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';
import { InventoryIntentRecovery } from './InventoryIntentRecovery';
import { formatInZone, getSalonTimezone } from '../../lib/salonTimezone';
import { EmptyState, inputClass, labelize, MetricStrip, Notice, PageHeader, pillClass, PillLink, PlatformPage, SegmentTabs, TitleStatus, Track, trackClass, usd, type Tone } from '../../components/salon-ui';

const icons: Record<WorkspaceSection, ComponentType<{ className?: string }>> = {
  clients: ContactRound, catalog: Scissors, benefits: Gift, inventory: Boxes,
  engagement: Megaphone, administration: Building2, reports: CircleDollarSign, integrations: Link2,
};

const emptyStates: Record<WorkspaceSection, string> = {
  clients: 'No clients yet', catalog: 'No services yet', benefits: 'No memberships, packages, or gift cards yet', inventory: 'No retail products yet',
  engagement: 'No one is on the waitlist', administration: 'No staff or locations yet', reports: 'No payments recorded yet', integrations: 'No providers or events yet',
};

const queueTitles: Record<WorkspaceSection, string> = {
  clients: 'Follow-up', catalog: 'Not bookable', benefits: 'Benefits on file', inventory: 'Stock',
  engagement: 'Demand', administration: 'Readiness', reports: 'Recent payments', integrations: 'Providers & events',
};

function formatMetric(value: number, format: string) {
  return format === 'money' ? usd(value) : new Intl.NumberFormat('en-US').format(value);
}
function formatDate(value: string | null | undefined, timeZone?: string) {
  return formatInZone(value, timeZone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Maps free-form record statuses onto a dot colour. */
function statusTone(status?: string | null): Tone {
  const value = (status || '').toLowerCase();
  if (/(fail|error|overdue|expired|low|out|missing|declin|blocked|unpaid)/.test(value)) return 'rose';
  if (/(pending|waiting|due|attention|draft|paused|inactive|on_leave|notified|review|retry)/.test(value)) return 'amber';
  if (/(active|ok|paid|complete|delivered|ready|healthy|connected|in stock|bookable|succeeded|settled)/.test(value)) return 'emerald';
  return 'zinc';
}

const reportRanges = [
  { value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }, { value: 'all', label: 'All time' },
];

export async function SalonWorkspacePage({ section, searchParams }: { section: WorkspaceSection; searchParams?: Promise<{ range?: string }> }) {
  const requested = section === 'reports' ? (await searchParams)?.range : undefined;
  const range = reportRanges.some((item) => item.value === requested) ? requested! : 'all';
  const kinds: Partial<Record<WorkspaceSection, SalonManagementKind[]>> = {
    clients: ['client'], catalog: ['category', 'service'], inventory: ['product'], administration: ['location', 'staff', 'resource'],
  };
  const [data, management, timeZone] = await Promise.all([
    getSalonWorkspace(section, section === 'reports' ? range : undefined),
    Promise.all((kinds[section] || []).map(async (kind) => ({ kind, data: await getSalonManagementWorkspace(kind) }))),
    getSalonTimezone(),
  ]);
  const Icon = icons[section];
  const locations = section === 'inventory' ? data.records.filter((record) => record.id.startsWith('location:')) : [];
  // Clients and services are already listed by their record managers; the queue shows only what needs action.
  const records = section === 'inventory' ? data.records.filter((record) => !record.id.startsWith('location:'))
    : section === 'catalog' ? data.records.filter((record) => record.status !== 'active' || record.metric === 0)
    : data.records;
  const showQueue = section !== 'clients' && !(section === 'catalog' && records.length === 0);

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: data.title }]}>
      <PageHeader
        icon={Icon}
        title={data.title}
        status={<TitleStatus tone={data.attentionCount > 0 ? 'amber' : 'emerald'}>{data.attentionCount > 0 ? data.attentionLabel || `${data.attentionCount} need attention` : 'All clear'}</TitleStatus>}
        actions={section === 'administration' ? (
          <Track>
            <PillLink href="/dashboard/platform/schedules" variant="quiet"><CalendarClock />Schedules</PillLink>
            <PillLink href="/dashboard/platform/resources" variant="quiet"><Armchair />Resources</PillLink>
          </Track>
        ) : null}
      />

      {section === 'reports' ? (
        <SegmentTabs label="Report period" active={range} tabs={reportRanges.map((item) => ({ value: item.value, label: item.label, href: item.value === 'all' ? '/dashboard/platform/reports' : `/dashboard/platform/reports?range=${item.value}` }))} />
      ) : null}

      {data.metrics.length > 0 ? (
        section === 'reports'
          ? <ReportTable metrics={data.metrics} />
          : <MetricStrip items={data.metrics.slice(0, 6).map((metric) => ({ label: metric.label, value: formatMetric(metric.value, metric.format) }))} />
      ) : null}

      {section === 'reports' ? (data.breakdowns || []).filter((table) => table.rows.length > 0).map((table) => <BreakdownTable key={table.title} table={table} />) : null}

      {management.map(({ kind, data: managed }) => <SalonRecordManager key={kind} kind={kind} data={managed} />)}
      {section === 'inventory' && <InventoryIntentRecovery key={data.actorId || 'unverified'} actorId={data.actorId || ''} />}
      {section === 'inventory' && locations.length === 0 && <Notice title="No active stock location">Add or activate a location before recording inventory movement.</Notice>}

      {!showQueue ? null : records.length === 0 ? <EmptyState icon={ShieldCheck} title={emptyStates[section]} /> : (
        <section aria-label={`${data.title} queue`} className="min-w-0 overflow-hidden rounded-2xl border bg-background">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3 md:px-5">
            <h2 className="text-sm font-semibold">{queueTitles[section]}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{records.length}</span>
          </div>
          <ul className="divide-y">
            {records.map((record) => <WorkspaceRow key={record.id} record={record} locations={locations} actorId={data.actorId || ''} timeZone={timeZone} />)}
          </ul>
        </section>
      )}
    </PlatformPage>
  );
}

function BreakdownTable({ table }: { table: { title: string; columns: string[]; rows: Array<{ label: string; cells: number[] }> } }) {
  const totals = table.columns.map((_, index) => table.rows.reduce((sum, row) => sum + (row.cells[index] || 0), 0));
  return (
    <section aria-label={table.title} className="min-w-0 overflow-hidden rounded-2xl border bg-background">
      <h2 className="border-b px-4 py-3 text-sm font-semibold md:px-5">{table.title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-4 py-2.5 font-medium md:px-5" />{table.columns.map((column) => <th key={column} className="px-3 py-2.5 text-right font-medium">{column}</th>)}</tr></thead>
          <tbody className="divide-y">
            {table.rows.map((row) => <tr key={row.label}><th scope="row" className="px-4 py-3 text-left font-medium md:px-5">{row.label}</th>{row.cells.map((cell, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{usd(cell)}</td>)}</tr>)}
            <tr className="bg-muted/30 font-semibold"><th scope="row" className="px-4 py-3 text-left md:px-5">Total</th>{totals.map((cell, index) => <td key={index} className="px-3 py-3 text-right tabular-nums">{usd(cell)}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportTable({ metrics }: { metrics: { label: string; value: number; format: string }[] }) {
  return (
    <section aria-label="Recorded financial totals" className="overflow-hidden rounded-2xl border bg-background">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-4 py-2.5 font-medium md:px-5">Recorded metric</th><th className="px-4 py-2.5 text-right font-medium md:px-5">Amount / count</th></tr></thead>
        <tbody className="divide-y">{metrics.map((metric) => <tr key={metric.label}><th scope="row" className="px-4 py-3 text-left font-normal md:px-5">{metric.label}</th><td className="px-4 py-3 text-right font-semibold tabular-nums md:px-5">{formatMetric(metric.value, metric.format)}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function WorkspaceRow({ record, locations, actorId, timeZone }: { record: WorkspaceRecord; locations: WorkspaceRecord[]; actorId: string; timeZone?: string }) {
  const amount = record.amount === null || record.amount === undefined ? null : usd(record.amount);
  const occurredAt = formatDate(record.occurredAt, timeZone);
  const isProduct = record.id.startsWith('product:');
  const isWaitlist = record.action === 'notify_waitlist' || record.action === 'remove_waitlist';

  return (
    <li className="grid min-w-0 gap-3 px-4 py-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="min-w-0 truncate text-sm font-semibold">{record.title}</h3>
          {record.status ? <TitleStatus tone={statusTone(record.status)}>{labelize(record.status)}</TitleStatus> : null}
        </div>
        {record.subtitle ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{record.subtitle}</p> : null}
        {record.detail || amount || occurredAt ? (
          <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 break-words text-xs text-muted-foreground">
            {record.detail ? <span>{record.detail}</span> : null}
            {amount ? <strong className="font-semibold tabular-nums text-foreground">{amount}</strong> : null}
            {occurredAt ? <time dateTime={record.occurredAt || undefined}>{occurredAt}</time> : null}
          </div>
        ) : null}
      </div>
      {isProduct || isWaitlist || record.href ? (
        <div className="grid min-w-0 gap-2 lg:w-[24rem] lg:justify-items-end">
          {isProduct ? <div className="w-full"><InventoryAdjustmentForm key={`${actorId}:${record.id}`} actorId={actorId} productId={record.id.replace('product:', '')} allowNew={record.action === 'adjust_inventory'} locations={locations.map(location => ({ id: location.id.replace('location:', ''), name: location.title }))} /></div> : null}
          {isWaitlist ? <WaitlistForm record={record} /> : null}
          {record.href ? <Track><PillLink href={record.href} size="sm" variant="quiet">Open<ArrowUpRight /></PillLink></Track> : null}
        </div>
      ) : null}
    </li>
  );
}

function WaitlistForm({ record }: { record: WorkspaceRecord }) {
  const action = record.action === 'notify_waitlist' ? 'notify' : 'remove';
  return (
    <form action={transitionWaitlistFromWorkspace} className="flex w-full min-w-0 items-center gap-2">
      <input type="hidden" name="waitlistEntryId" value={record.id} /><input type="hidden" name="action" value={action} />
      <label className="min-w-0 flex-1"><span className="sr-only">Note</span><input name="reason" maxLength={500} placeholder={action === 'notify' ? 'Note · slot offered by phone' : 'Removal reason'} className={`${inputClass} h-8 rounded-lg text-xs`} /></label>
      <div className={trackClass}><button type="submit" className={pillClass(action === 'notify' ? 'primary' : 'danger', 'sm')}>{action === 'notify' ? 'Mark notified' : 'Remove'}</button></div>
    </form>
  );
}
