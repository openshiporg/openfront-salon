import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Boxes, Building2, CircleDollarSign, ContactRound, Gift, Link2, Megaphone, Scissors, ShieldCheck } from 'lucide-react';
import { getSalonManagementWorkspace, getSalonWorkspace, SalonManagementKind, transitionWaitlistFromWorkspace, WorkspaceRecord, WorkspaceSection } from '../actions/workspaces';
import { SalonRecordManager } from './SalonRecordManager';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';
import { InventoryIntentRecovery } from './InventoryIntentRecovery';

const icons: Record<WorkspaceSection, ComponentType<{ className?: string }>> = {
  clients: ContactRound, catalog: Scissors, benefits: Gift, inventory: Boxes,
  engagement: Megaphone, administration: Building2, reports: CircleDollarSign, integrations: Link2,
};

const emptyStates: Record<WorkspaceSection, string> = {
  clients: 'No clients yet', catalog: 'No services yet', benefits: 'No memberships, packages, or gift cards yet', inventory: 'No retail products yet',
  engagement: 'No one is on the waitlist', administration: 'No staff or locations yet', reports: 'No payments recorded yet', integrations: 'No providers or events yet',
};

function formatMetric(value: number, format: string) {
  if (format === 'money') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
  return new Intl.NumberFormat('en-US').format(value);
}
function formatAmount(value?: number | null) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
}
function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function SalonWorkspacePage({ section }: { section: WorkspaceSection }) {
  const kinds: Partial<Record<WorkspaceSection, SalonManagementKind[]>> = {
    clients: ['client'], catalog: ['category', 'service'], inventory: ['product'], administration: ['location', 'staff', 'resource'],
  };
  const [data, management] = await Promise.all([
    getSalonWorkspace(section),
    Promise.all((kinds[section] || []).map(async (kind) => ({ kind, data: await getSalonManagementWorkspace(kind) }))),
  ]);
  const Icon = icons[section];
  const locations = section === 'inventory' ? data.records.filter((record) => record.id.startsWith('location:')) : [];
  const records = section === 'inventory' ? data.records.filter((record) => !record.id.startsWith('location:')) : data.records;

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <header className="border bg-background p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl"><Icon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />{data.title}</h1>

            </div>

          </div>
        </header>

        {section === 'reports' ? <section aria-label="Recorded financial totals" className="overflow-x-auto border bg-background"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Recorded metric</th><th className="p-3 text-right">Amount / count</th></tr></thead><tbody>{data.metrics.map(metric => <tr key={metric.label} className="border-b last:border-0"><th scope="row" className="p-3 text-left font-normal">{metric.label}</th><td className="p-3 text-right tabular-nums">{formatMetric(metric.value, metric.format)}</td></tr>)}</tbody></table></section> : null}

        {section === 'administration' && <QuickLinks />}
        {management.map(({ kind, data: records }) => <SalonRecordManager key={kind} kind={kind} data={records} />)}
        {section === 'inventory' && <InventoryIntentRecovery key={data.actorId || 'unverified'} actorId={data.actorId || ''} />}
        {section === 'inventory' && locations.length === 0 && <Notice>No active stock location is configured. Add or activate a location before recording inventory movement.</Notice>}
        {records.length === 0 ? <EmptyState section={section} /> : (
          <section aria-label={`${data.title} queue`} className="grid min-w-0 gap-3">
            {records.map((record) => <WorkspaceRow key={record.id} record={record} locations={locations} actorId={data.actorId || ''} />)}
          </section>
        )}
      </div>
    </main>
  );
}

function WorkspaceRow({ record, locations, actorId }: { record: WorkspaceRecord; locations: WorkspaceRecord[]; actorId: string }) {
  const amount = formatAmount(record.amount);
  const occurredAt = formatDate(record.occurredAt);
  return (
    <article className="min-w-0 max-w-full overflow-hidden border bg-background p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{record.title}</h2>
            {record.status && <span className="border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">{record.status}</span>}
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">{record.subtitle || 'No additional context'}</p>
          <div className="mt-3 flex min-w-0 flex-wrap gap-x-5 gap-y-1 break-words text-xs text-muted-foreground">
            {record.detail && <span>{record.detail}</span>}
            {amount && <strong className="font-medium text-foreground">{amount}</strong>}
            {occurredAt && <time dateTime={record.occurredAt || undefined}>{occurredAt}</time>}
          </div>
        </div>
        <div className="shrink-0 lg:w-[25rem]">
          {record.id.startsWith('product:') ? <InventoryAdjustmentForm key={`${actorId}:${record.id}`} actorId={actorId} productId={record.id.replace('product:', '')} allowNew={record.action === 'adjust_inventory'} locations={locations.map(location => ({ id: location.id.replace('location:', ''), name: location.title }))} /> : null}
          {record.action === 'notify_waitlist' || record.action === 'remove_waitlist' ? <WaitlistForm record={record} /> : null}
          {record.href ? <Link href={record.href} className="inline-flex w-full items-center justify-center gap-2 border px-3 py-2 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">Open <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
        </div>
      </div>
    </article>
  );
}

function WaitlistForm({ record }: { record: WorkspaceRecord }) {
  const action = record.action === 'notify_waitlist' ? 'notify' : 'remove';
  return <form action={transitionWaitlistFromWorkspace} className="mb-2 grid gap-2 border bg-muted/30 p-2">
    <input type="hidden" name="waitlistEntryId" value={record.id} /><input type="hidden" name="action" value={action} />
    <label className="text-xs font-medium">Note<input name="reason" maxLength={500} placeholder={action === 'notify' ? 'Slot offered by phone' : 'Removal reason'} className="mt-1 h-8 w-full border bg-background px-2 text-sm" /></label>
    <button type="submit" className="bg-foreground px-3 py-2 text-sm font-medium text-background focus:outline-none focus:ring-2 focus:ring-ring">{action === 'notify' ? 'Mark client notified' : 'Remove from waitlist'}</button>
  </form>;
}

function QuickLinks() { return <nav aria-label="Staff and location administration shortcuts" className="grid gap-2 sm:grid-cols-2"><Link href="/dashboard/platform/schedules" className="flex items-center justify-between border bg-background p-4 text-sm font-medium hover:bg-muted">Manage schedule coverage <ArrowUpRight className="h-4 w-4" /></Link><Link href="/dashboard/platform/resources" className="flex items-center justify-between border bg-background p-4 text-sm font-medium hover:bg-muted">Manage location resources <ArrowUpRight className="h-4 w-4" /></Link></nav>; }
function Notice({ children }: { children: ReactNode }) { return <div role="status" className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{children}</div>; }
function EmptyState({ section }: { section: WorkspaceSection }) { return <section className="border bg-background p-12 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 text-lg font-semibold">{emptyStates[section]}</h2></section>; }
