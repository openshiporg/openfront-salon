import Link from 'next/link';
import { Armchair, ArrowUpRight, CalendarClock, ChevronRight, ListOrdered, ShieldCheck } from 'lucide-react';
import { getSalonManagementWorkspace, getSalonWorkspace, SalonManagementData, SalonManagementKind, transitionWaitlistFromWorkspace, WorkspaceBreakdown, WorkspaceData, WorkspaceMetric, WorkspaceRecord, WorkspaceSection } from '../actions/workspaces';
import { SalonRecordManager, type RecordExtra } from './SalonRecordManager';
import { InventoryIntentRecovery } from './InventoryIntentRecovery';
import { StockDesk, type StockProduct } from './StockDesk';
import { getServiceTakings, type ServiceTakingsRow } from '../lib/serviceTakings';
import { formatInZone, getSalonTimezone } from '../../lib/salonTimezone';
import { DataTable, EmptyState, inputClass, labelize, Notice, PageHeader, pillClass, PillLink, PlatformPage, SegmentTabs, StatusCell, Td, TitleStatus, Track, usd, type Tone } from '../../components/salon-ui';

const emptyStates: Record<WorkspaceSection, string> = {
  clients: 'No clients yet', catalog: 'No services yet', benefits: 'No memberships, packages, or gift cards yet', inventory: 'No retail products yet',
  engagement: 'No one is on the waitlist', administration: 'No staff or locations yet', reports: 'No payments recorded yet', integrations: 'No providers or events yet',
};

function formatMetric(value: number, format: string) {
  return format === 'money' ? usd(value) : new Intl.NumberFormat('en-US').format(value);
}
function formatDate(value: string | null | undefined, timeZone?: string) {
  return formatInZone(value, timeZone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function metricValue(metrics: WorkspaceMetric[], label: string) {
  return metrics.find((metric) => metric.label === label)?.value ?? 0;
}
function plural(count: number, word: string, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

/** Maps free-form record statuses onto a dot colour. */
function statusTone(status?: string | null): Tone {
  const value = (status || '').toLowerCase();
  if (/(fail|error|overdue|expired|low|out|missing|declin|blocked|unpaid|dead|not installed)/.test(value)) return 'rose';
  if (/(pending|waiting|due|attention|draft|paused|inactive|on_leave|notified|review|retry|reorder)/.test(value)) return 'amber';
  if (/(active|ok|paid|complete|delivered|ready|healthy|connected|in stock|bookable|succeeded|settled|installed|processed|sent)/.test(value)) return 'emerald';
  return 'zinc';
}

const reportRanges = [
  { value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }, { value: 'all', label: 'All time' },
];

export async function SalonWorkspacePage({ section, searchParams }: { section: WorkspaceSection; searchParams?: Promise<{ range?: string }> }) {
  const requested = section === 'reports' ? (await searchParams)?.range : undefined;
  const range = reportRanges.some((item) => item.value === requested) ? requested! : 'all';
  const kinds: Partial<Record<WorkspaceSection, SalonManagementKind[]>> = {
    clients: ['client'], catalog: ['service', 'category'], inventory: ['product'], administration: ['staff', 'location', 'resource'],
  };
  const timeZone = await getSalonTimezone();
  const [data, management, serviceTakings] = await Promise.all([
    getSalonWorkspace(section, section === 'reports' ? range : undefined),
    Promise.all((kinds[section] || []).map(async (kind) => ({ kind, data: await getSalonManagementWorkspace(kind) }))),
    section === 'reports' ? getServiceTakings(range, timeZone) : Promise.resolve(null),
  ]);
  const managed = Object.fromEntries(management.map((item) => [item.kind, item.data])) as Partial<Record<SalonManagementKind, SalonManagementData>>;
  const props = { data, managed, timeZone };

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: data.title }]}>
      {section === 'catalog' ? <CatalogView {...props} />
        : section === 'inventory' ? <InventoryView {...props} />
        : section === 'administration' ? <AdministrationView {...props} />
        : section === 'reports' ? <ReportsView {...props} range={range} serviceTakings={serviceTakings} />
        : section === 'integrations' ? <IntegrationsView {...props} />
        : section === 'engagement' ? <EngagementView {...props} />
        : <GenericView {...props} section={section} />}
    </PlatformPage>
  );
}

type ViewProps = { data: WorkspaceData; managed: Partial<Record<SalonManagementKind, SalonManagementData>>; timeZone?: string };

function AttentionStatus({ data }: { data: WorkspaceData }) {
  return data.attentionCount > 0 ? <TitleStatus tone="amber">{data.attentionLabel || `${data.attentionCount} need attention`}</TitleStatus> : null;
}

/* Catalog: the service table is the page. */
function CatalogView({ data, managed }: ViewProps) {
  const services = managed.service;
  const stylists = services?.stylists || [];
  const notOnline = (services?.records || []).filter((record) => record.status !== 'active' || !(record.specialists || []).some((item) => { const stylist = stylists.find((option) => option.id === item.id); return stylist && stylist.isActive !== false && stylist.status !== 'inactive'; })).length;
  return (
    <>
      <PageHeader
        title={data.title}
        status={notOnline ? <TitleStatus tone="amber">{notOnline} not bookable online</TitleStatus> : null}
        meta={<span>{plural(metricValue(data.metrics, 'Active services'), 'active service')} · {plural(metricValue(data.metrics, 'Categories'), 'category', 'categories')}</span>}
      />
      {services ? <SalonRecordManager kind="service" data={services} title="Services" /> : null}
      {managed.category ? <SalonRecordManager kind="category" data={managed.category} title="Categories" /> : null}
    </>
  );
}

/* Inventory: what is low and recording stock first; products and movements as separate tables. */
function InventoryView({ data, managed, timeZone }: ViewProps) {
  const locations = data.records.filter((record) => record.id.startsWith('location:')).map((record) => ({ id: record.id.replace('location:', ''), name: record.title }));
  const productRows = data.records.filter((record) => record.id.startsWith('product:'));
  const movements = data.records.filter((record) => record.id.startsWith('movement:'));
  const reorderPoints = new Map((managed.product?.records || []).map((record) => [record.id, record.reorderPoint ?? 0]));
  const stock: StockProduct[] = productRows.map((record) => {
    const id = record.id.replace('product:', '');
    return { id, name: record.title, sku: record.subtitle === 'No SKU' ? null : record.subtitle, onHand: record.metric ?? 0, reorderAt: reorderPoints.get(id) ?? 0, low: record.status === 'Reorder', canAdjust: record.action === 'adjust_inventory' };
  });
  const extras: Record<string, RecordExtra> = Object.fromEntries(stock.map((product) => [product.id, { value: String(product.onHand), tone: product.low ? 'rose' : undefined }]));
  const low = stock.filter((product) => product.low).length;
  return (
    <>
      <PageHeader
        title={data.title}
        status={low ? <TitleStatus tone="amber">{low} to reorder</TitleStatus> : null}
        meta={<span>{plural(metricValue(data.metrics, 'Active products'), 'active product')} · {formatMetric(metricValue(data.metrics, 'Units on hand'), 'count')} units on hand</span>}
      />
      <InventoryIntentRecovery key={data.actorId || 'unverified'} actorId={data.actorId || ''} />
      {locations.length === 0 ? <Notice title="No active stock location">Add or activate a location before recording inventory movement.</Notice> : null}
      {stock.length ? <StockDesk actorId={data.actorId || ''} products={stock} locations={locations} /> : null}
      {managed.product ? <SalonRecordManager kind="product" data={managed.product} extras={extras} title="Products" /> : null}
      <section aria-labelledby="stock-movements" className="grid gap-2">
        <h2 id="stock-movements" className="text-sm font-semibold">Stock movements</h2>
        <DataTable label="Recent stock movements" head={[{ label: 'When' }, { label: 'Product' }, { label: 'Type', className: 'hidden sm:table-cell' }, { label: 'Change', className: 'text-right' }, { label: 'Balance', className: 'text-right' }, { label: 'Reason', className: 'hidden md:table-cell' }]}>
          {movements.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">No stock movements yet.</Td></tr> : movements.map((record) => {
            const [change, , ...reason] = (record.detail || '').split(' · ');
            return (
              <tr key={record.id}>
                <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
                <Td><span className="font-medium">{record.title}</span><span className="block text-xs text-muted-foreground">{record.subtitle}</span></Td>
                <Td className="hidden whitespace-nowrap sm:table-cell">{labelize(record.status)}</Td>
                <Td className={`text-right font-medium tabular-nums ${change?.startsWith('-') ? 'text-rose-700 dark:text-rose-400' : ''}`}>{change || '—'}</Td>
                <Td className="text-right tabular-nums">{record.metric ?? '—'}</Td>
                <Td className="hidden text-muted-foreground md:table-cell">{reason.join(' · ') || '—'}</Td>
              </tr>
            );
          })}
        </DataTable>
      </section>
    </>
  );
}

/* Administration: staff, then locations, then resources, each listed once. */
function AdministrationView({ data, managed }: ViewProps) {
  const extras: Record<string, RecordExtra> = {};
  data.records.forEach((record) => {
    if (record.id.startsWith('stylist:')) {
      const days = record.metric ?? 0;
      extras[record.id.replace('stylist:', '')] = { value: days ? plural(days, 'day') : 'No hours', tone: days ? undefined : 'amber' };
    } else if (record.id.startsWith('location:')) {
      extras[record.id.replace('location:', '')] = { value: record.detail || '—' };
    }
  });
  return (
    <>
      <PageHeader
        title={data.title}
        status={<AttentionStatus data={data} />}
        actions={<Track><PillLink href="/dashboard/platform/schedules" variant="quiet"><CalendarClock />Schedules</PillLink><PillLink href="/dashboard/platform/resources" variant="quiet"><Armchair />Resources</PillLink></Track>}
      />
      {managed.staff ? <SalonRecordManager kind="staff" data={managed.staff} extras={extras} title="Staff" /> : null}
      {managed.location ? <SalonRecordManager kind="location" data={managed.location} extras={extras} title="Locations" /> : null}
      {managed.resource ? <SalonRecordManager kind="resource" data={managed.resource} title="Booking resources" /> : null}
    </>
  );
}

/* Reports: takings by stylist and by service first; totals and tender below. */
function ReportsView({ data, timeZone, range, serviceTakings }: ViewProps & { range: string; serviceTakings: ServiceTakingsRow[] | null }) {
  const breakdowns = data.breakdowns || [];
  const byStylist = breakdowns.find((table) => table.title === 'By stylist');
  const byMethod = breakdowns.find((table) => table.title === 'By payment method');
  const others = breakdowns.filter((table) => table !== byStylist && table !== byMethod && table.rows.length > 0);
  const unpaid = data.attentionCount;
  return (
    <>
      <PageHeader
        title={data.title}
        meta={unpaid ? <Link href="/dashboard/platform/commissions" className="underline-offset-4 hover:text-foreground hover:underline">{data.attentionLabel}</Link> : null}
      />
      <SegmentTabs label="Report period" active={range} tabs={reportRanges.map((item) => ({ value: item.value, label: item.label, href: item.value === 'all' ? '/dashboard/platform/reports' : `/dashboard/platform/reports?range=${item.value}` }))} />
      {data.metrics.length ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 border-b pb-4">
          {data.metrics.map((metric) => <div key={metric.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{metric.label}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums">{formatMetric(metric.value, metric.format)}</dd></div>)}
        </dl>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <BreakdownTable title="Takings by stylist" table={byStylist} empty="No stylist takings in this period." />
        <ServiceTakingsTable rows={serviceTakings} />
      </div>
      <BreakdownTable title="Takings by payment method" table={byMethod} empty="No payments in this period." />
      {others.map((table) => <BreakdownTable key={table.title} title={table.title} table={table} empty="" />)}
      <section aria-labelledby="recent-payments" className="grid gap-2">
        <h2 id="recent-payments" className="text-sm font-semibold">Recent payments</h2>
        <DataTable label="Recent payments" head={[{ label: 'When' }, { label: 'Payment' }, { label: 'Location', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: 'Tip · refunded', className: 'hidden sm:table-cell' }, { label: 'Net', className: 'text-right' }]}>
          {data.records.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">No payments recorded in this period.</Td></tr> : data.records.map((record) => (
            <tr key={record.id}>
              <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
              <Td className="font-medium">{record.title}</Td>
              <Td className="hidden text-muted-foreground md:table-cell">{record.subtitle}</Td>
              <Td><StatusCell tone={statusTone(record.status)}>{labelize(record.status)}</StatusCell></Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground sm:table-cell">{record.detail}</Td>
              <Td className="text-right font-medium tabular-nums">{usd(record.amount)}</Td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

function BreakdownTable({ title, table, empty }: { title: string; table?: WorkspaceBreakdown; empty: string }) {
  const rows = table?.rows || [];
  const columns = table?.columns || [];
  const totals = columns.map((_, index) => rows.reduce((sum, row) => sum + (row.cells[index] || 0), 0));
  return (
    <section aria-label={title} className="grid min-w-0 gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="rounded-[6px] border bg-background px-3 py-3 text-sm text-muted-foreground">{empty}</p> : (
        <DataTable label={title} head={[{ label: title.includes('stylist') ? 'Stylist' : title.includes('method') ? 'Method' : '' }, ...columns.map((column) => ({ label: column, className: 'text-right' }))]}>
          {rows.map((row) => <tr key={row.label}><Td className="font-medium">{row.label}</Td>{row.cells.map((cell, index) => <Td key={index} className="text-right tabular-nums">{usd(cell)}</Td>)}</tr>)}
          <tr className="bg-muted/30 font-semibold"><Td>Total</Td>{totals.map((cell, index) => <Td key={index} className="text-right tabular-nums">{usd(cell)}</Td>)}</tr>
        </DataTable>
      )}
    </section>
  );
}

function ServiceTakingsTable({ rows }: { rows: ServiceTakingsRow[] | null }) {
  return (
    <section aria-label="Takings by service" className="grid min-w-0 gap-2">
      <h2 className="text-sm font-semibold">Takings by service</h2>
      {rows === null ? <p className="rounded-[6px] border bg-background px-3 py-3 text-sm text-muted-foreground">Service takings couldn&apos;t be loaded.</p>
        : rows.length === 0 ? <p className="rounded-[6px] border bg-background px-3 py-3 text-sm text-muted-foreground">No service takings in this period.</p> : (
          <DataTable label="Takings by service" head={[{ label: 'Service' }, { label: 'Sold', className: 'text-right' }, { label: 'Net', className: 'text-right' }]}>
            {rows.map((row) => <tr key={row.label}><Td className="font-medium">{row.label}</Td><Td className="text-right tabular-nums">{row.count}</Td><Td className="text-right tabular-nums">{usd(row.net)}</Td></tr>)}
            <tr className="bg-muted/30 font-semibold"><Td>Total</Td><Td className="text-right tabular-nums">{rows.reduce((sum, row) => sum + row.count, 0)}</Td><Td className="text-right tabular-nums">{usd(rows.reduce((sum, row) => sum + row.net, 0))}</Td></tr>
          </DataTable>
        )}
    </section>
  );
}

/* Integrations: the real exception first, events grouped by type, raw list on demand. */
function IntegrationsView({ data, timeZone }: ViewProps) {
  const providers = data.records.filter((record) => record.id.startsWith('provider:'));
  const events = data.records.filter((record) => record.id.startsWith('event:'));
  const webhooks = data.records.filter((record) => record.id.startsWith('webhook:'));
  const notInstalled = providers.filter((record) => record.status === 'Not installed');
  const installed = providers.length - notInstalled.length;
  const queued = metricValue(data.metrics, 'Queued, not delivered');
  const failed = metricValue(data.metrics, 'Failed events');
  const groups = [...events.reduce((map, record) => {
    const key = `${record.title}|${record.status}`;
    const group = map.get(key) || { type: record.title, status: record.status || '', count: 0, attempts: 0, oldest: record.occurredAt, newest: record.occurredAt };
    group.count += 1;
    group.attempts = Math.max(group.attempts, record.metric || 0);
    if (record.occurredAt && (!group.oldest || record.occurredAt < group.oldest)) group.oldest = record.occurredAt;
    if (record.occurredAt && (!group.newest || record.occurredAt > group.newest)) group.newest = record.occurredAt;
    map.set(key, group);
    return map;
  }, new Map<string, { type: string; status: string; count: number; attempts: number; oldest?: string | null; newest?: string | null }>()).values()].sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader
        title={data.title}
        status={providers.length > 0 && installed === 0 ? <TitleStatus tone="rose">No payment provider installed</TitleStatus>
          : data.attentionCount ? <TitleStatus tone="amber">{data.attentionLabel || `${data.attentionCount} need attention`}</TitleStatus>
          : providers.length ? <TitleStatus tone="emerald">No delivery backlog</TitleStatus> : null}
      />
      {providers.length > 0 && installed === 0 ? (
        <Notice tone="rose" title="No payment provider installed">{notInstalled.map((record) => record.title).join(', ')}</Notice>
      ) : notInstalled.length ? (
        <Notice tone="amber" title={`${plural(notInstalled.length, 'payment provider')} not installed`}>{notInstalled.map((record) => record.title).join(', ')}</Notice>
      ) : null}
      {queued + failed > 0 ? (
        <Notice tone={failed ? 'rose' : 'amber'} title={[queued ? `${queued} events queued, not delivered` : '', failed ? `${failed} failed` : ''].filter(Boolean).join(' · ')} />
      ) : null}

      <section aria-labelledby="providers" className="grid gap-2">
        <h2 id="providers" className="text-sm font-semibold">Payment providers</h2>
        <DataTable label="Payment providers" head={[{ label: 'Provider' }, { label: 'Adapter', className: 'hidden sm:table-cell' }, { label: 'Status' }]}>
          {providers.length === 0 ? <tr><Td colSpan={3} className="py-4 text-muted-foreground">No payment providers configured.</Td></tr> : providers.map((record) => (
            <tr key={record.id}>
              <Td className="font-medium">{record.title}</Td>
              <Td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{record.subtitle}</Td>
              <Td><StatusCell tone={record.status === 'Not installed' ? 'rose' : 'emerald'}>{record.status}</StatusCell></Td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section aria-labelledby="undelivered" className="grid gap-2">
        <h2 id="undelivered" className="flex items-baseline gap-2 text-sm font-semibold">Undelivered events<span className="text-xs font-normal tabular-nums text-muted-foreground">{queued + failed}</span></h2>
        <DataTable label="Undelivered events by type" head={[{ label: 'Event type' }, { label: 'Status' }, { label: 'Count', className: 'text-right' }, { label: 'Most attempts', className: 'hidden sm:table-cell text-right' }, { label: 'Oldest', className: 'hidden md:table-cell' }, { label: 'Latest', className: 'hidden md:table-cell' }]}>
          {groups.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">Every event has been delivered.</Td></tr> : groups.map((group) => (
            <tr key={`${group.type}|${group.status}`}>
              <Td className="font-medium">{group.type}</Td>
              <Td><StatusCell tone={statusTone(group.status)}>{group.status === 'dead_letter' ? 'Failed' : labelize(group.status)}</StatusCell></Td>
              <Td className="text-right font-medium tabular-nums">{group.count}</Td>
              <Td className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{group.attempts}</Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{formatDate(group.oldest, timeZone) || '—'}</Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{formatDate(group.newest, timeZone) || '—'}</Td>
            </tr>
          ))}
        </DataTable>
        {events.length ? (
          <details className="group rounded-[6px] border bg-background">
            <summary className="flex h-9 cursor-pointer list-none items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden="true" className="mr-1.5 size-3.5 transition-transform duration-150 ease-out group-open:rotate-90" />
              Raw events · latest {events.length}{queued + failed > events.length ? ` of ${queued + failed}` : ''}
            </summary>
            <div className="overflow-x-auto border-t">
              <table className="w-full border-collapse text-sm" aria-label="Raw undelivered events">
                <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="h-9 border-b bg-muted/40 px-3 font-medium">Occurred</th><th scope="col" className="h-9 border-b bg-muted/40 px-3 font-medium">Event</th><th scope="col" className="h-9 border-b bg-muted/40 px-3 font-medium">Record</th><th scope="col" className="h-9 border-b bg-muted/40 px-3 font-medium">Status</th><th scope="col" className="h-9 border-b bg-muted/40 px-3 text-right font-medium">Attempts</th></tr></thead>
                <tbody>
                  {events.map((record) => (
                    <tr key={record.id}>
                      <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
                      <Td>{record.title}</Td>
                      <Td className="break-all font-mono text-xs text-muted-foreground">{record.subtitle}</Td>
                      <Td className="whitespace-nowrap">{labelize(record.status)}</Td>
                      <Td className="text-right tabular-nums">{record.metric ?? 0}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="webhooks" className="grid gap-2">
        <h2 id="webhooks" className="text-sm font-semibold">Recent provider webhooks</h2>
        <DataTable label="Recent provider webhooks" head={[{ label: 'Processed' }, { label: 'Type' }, { label: 'Provider', className: 'hidden sm:table-cell' }, { label: 'Status' }]}>
          {webhooks.length === 0 ? <tr><Td colSpan={4} className="py-4 text-muted-foreground">No webhooks received.</Td></tr> : webhooks.map((record) => (
            <tr key={record.id}>
              <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
              <Td className="font-medium">{record.title}</Td>
              <Td className="hidden text-muted-foreground sm:table-cell">{record.subtitle}</Td>
              <Td><StatusCell tone={statusTone(record.status)}>{labelize(record.status)}</StatusCell></Td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

/* Engagement: who to contact first; delivery exceptions named, not dumped. */
function EngagementView({ data, timeZone }: ViewProps) {
  const waitlist = data.records.filter((record) => !record.id.startsWith('message:'));
  const messages = data.records.filter((record) => record.id.startsWith('message:'));
  const failed = metricValue(data.metrics, 'Delivery failures');
  const undelivered = metricValue(data.metrics, 'Events not delivered');
  return (
    <>
      <PageHeader
        title={data.title}
        status={<AttentionStatus data={data} />}
        meta={<span>{plural(metricValue(data.metrics, 'Messages sent'), 'message')} sent</span>}
        actions={<Track><PillLink href="/dashboard/platform/waitlist" variant="quiet"><ListOrdered />Walk-in waitlist</PillLink></Track>}
      />
      {failed ? <Notice tone="rose" title={`${plural(failed, 'message')} failed to deliver`} /> : null}
      {undelivered ? <Notice title={`${undelivered} events queued, not delivered`}><Link href="/dashboard/platform/integrations" className="underline underline-offset-4 hover:text-foreground">Review in Integrations</Link></Notice> : null}

      <section aria-labelledby="to-contact" className="grid gap-2">
        <h2 id="to-contact" className="flex items-baseline gap-2 text-sm font-semibold">Booking waitlist<span className="text-xs font-normal tabular-nums text-muted-foreground">{waitlist.length}</span></h2>
        <DataTable label="Booking waitlist" head={[{ label: 'Client' }, { label: 'Service', className: 'hidden sm:table-cell' }, { label: 'Preference', className: 'hidden lg:table-cell' }, { label: 'Status' }, { label: 'Added', className: 'hidden md:table-cell' }, { label: 'Action', className: 'w-[22rem] max-sm:w-auto' }]}>
          {waitlist.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">{emptyStates.engagement}</Td></tr> : waitlist.map((record) => (
            <tr key={record.id}>
              <Td><span className="font-medium">{record.title}</span><span className="block text-xs text-muted-foreground sm:hidden">{record.subtitle}</span></Td>
              <Td className="hidden sm:table-cell">{record.subtitle}</Td>
              <Td className="hidden text-muted-foreground lg:table-cell">{record.detail}</Td>
              <Td><StatusCell tone={statusTone(record.status)}>{labelize(record.status)}</StatusCell></Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
              <Td>{record.action === 'notify_waitlist' || record.action === 'remove_waitlist' ? <WaitlistForm record={record} /> : null}</Td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section aria-labelledby="messages" className="grid gap-2">
        <h2 id="messages" className="text-sm font-semibold">Recent messages</h2>
        <DataTable label="Recent messages" head={[{ label: 'Sent' }, { label: 'Message' }, { label: 'Recipient', className: 'hidden sm:table-cell' }, { label: 'Status' }]}>
          {messages.length === 0 ? <tr><Td colSpan={4} className="py-4 text-muted-foreground">No messages sent yet.</Td></tr> : messages.map((record) => (
            <tr key={record.id}>
              <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
              <Td className="font-medium">{record.title}</Td>
              <Td className="hidden sm:table-cell">{record.subtitle}</Td>
              <Td><StatusCell tone={statusTone(record.status)}>{labelize(record.status)}</StatusCell></Td>
            </tr>
          ))}
        </DataTable>
      </section>
    </>
  );
}

function WaitlistForm({ record }: { record: WorkspaceRecord }) {
  const action = record.action === 'notify_waitlist' ? 'notify' : 'remove';
  return (
    <form action={transitionWaitlistFromWorkspace} className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
      <input type="hidden" name="waitlistEntryId" value={record.id} /><input type="hidden" name="action" value={action} />
      <label className="min-w-0 flex-1 basis-40"><span className="sr-only">{action === 'notify' ? 'Note' : 'Removal reason'}</span><input name="reason" maxLength={500} placeholder={action === 'notify' ? 'Note' : 'Removal reason'} className={`${inputClass} h-8 text-xs`} /></label>
      <button type="submit" className={pillClass(action === 'notify' ? 'primary' : 'danger', 'sm')}>{action === 'notify' ? 'Mark notified' : 'Remove'}</button>
    </form>
  );
}

/* Clients and benefits: record table plus the work queue. */
function GenericView({ data, managed, timeZone, section }: ViewProps & { section: WorkspaceSection }) {
  const showQueue = section !== 'clients';
  return (
    <>
      <PageHeader
        title={data.title}
        status={<AttentionStatus data={data} />}
        meta={data.metrics.length ? <span>{data.metrics.slice(0, 3).map((metric) => `${formatMetric(metric.value, metric.format)} ${metric.label.toLowerCase()}`).join(' · ')}</span> : null}
      />
      {managed.client ? <SalonRecordManager kind="client" data={managed.client} title="Clients" /> : null}
      {!showQueue ? null : data.records.length === 0 ? <EmptyState icon={ShieldCheck} title={emptyStates[section]} /> : (
        <DataTable label={data.title} head={[{ label: 'Name' }, { label: 'Detail', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: 'Amount', className: 'text-right' }, { label: 'Date', className: 'hidden sm:table-cell' }, { label: '', className: 'w-px' }]}>
          {data.records.map((record) => (
            <tr key={record.id}>
              <Td><span className="font-medium">{record.title}</span>{record.subtitle ? <span className="block text-xs text-muted-foreground">{record.subtitle}</span> : null}</Td>
              <Td className="hidden text-muted-foreground md:table-cell">{record.detail}</Td>
              <Td>{record.status ? <StatusCell tone={statusTone(record.status)}>{labelize(record.status)}</StatusCell> : null}</Td>
              <Td className="text-right tabular-nums">{record.amount === null || record.amount === undefined ? '—' : usd(record.amount)}</Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground sm:table-cell">{formatDate(record.occurredAt, timeZone) || '—'}</Td>
              <Td>{record.href ? <PillLink href={record.href} size="sm" variant="quiet">Open<ArrowUpRight /></PillLink> : null}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
