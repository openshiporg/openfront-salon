import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { Gift, Package, Plus, Sparkles, UserPlus } from 'lucide-react';
import { getBenefits, savePlan, sellBenefit, setBenefitStatus, type MembershipPlan, type PackagePlan } from '../actions/benefits';
import { ActionForm } from '../../components/ActionForm';
import { EmptyState, ErrorState, fieldLabelClass, inputClass, labelize, MetricStrip, PageHeader, Panel, PillLink, PlatformPage, TitleStatus, Track, textareaClass, usd, type Tone } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

const statusTone: Record<string, Tone> = { active: 'emerald', paused: 'amber', cancelled: 'zinc', expired: 'rose', 'fully-used': 'zinc' };

function PlanFields({ kind, plan, services }: { kind: 'membership' | 'package'; plan?: MembershipPlan | PackagePlan; services: { id: string; name: string }[] }) {
  const membership = kind === 'membership' ? plan as MembershipPlan | undefined : undefined;
  const pack = kind === 'package' ? plan as PackagePlan | undefined : undefined;
  const selected = (membership?.includedServices || pack?.services || []).map((service) => service.id);
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={fieldLabelClass}>Name<input name="name" required maxLength={200} defaultValue={plan?.name || ''} className={inputClass} /></label>
        <label className={fieldLabelClass}>{kind === 'membership' ? 'Monthly price' : 'Package price'}<input name="price" type="number" min="0" step="0.01" required inputMode="decimal" defaultValue={plan ? ((membership?.monthlyPrice ?? pack?.totalPrice ?? 0) / 100).toFixed(2) : ''} className={inputClass} /></label>
        {kind === 'membership' ? (
          <label className={fieldLabelClass}>Member discount (%)<input name="discountPercent" type="number" min="0" max="100" step="1" inputMode="numeric" defaultValue={membership?.discountPercent ?? 10} className={inputClass} /></label>
        ) : (
          <>
            <label className={fieldLabelClass}>Client saves<input name="savings" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={((pack?.savingsAmount || 0) / 100).toFixed(2)} className={inputClass} /></label>
            <label className={fieldLabelClass}>Valid for (days)<input name="validDays" type="number" min="0" max="3650" step="1" inputMode="numeric" defaultValue={pack?.validDays ?? 365} className={inputClass} /></label>
          </>
        )}
        <label className="flex min-h-10 items-center gap-2 self-end rounded-xl border bg-background px-3 text-sm"><input type="checkbox" name="isActive" value="true" defaultChecked={plan?.isActive !== false} className="h-4 w-4 accent-foreground" />Available to sell</label>
      </div>
      <label className={fieldLabelClass}>{kind === 'membership' ? 'Services the discount covers' : 'Services in the package'}
        <select name="serviceIds" multiple defaultValue={selected} className="min-h-28 w-full rounded-xl border bg-background px-2 py-2 text-sm">{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
      </label>
      <label className={fieldLabelClass}>Description<textarea name="description" maxLength={2000} defaultValue={plan?.description || ''} className={`${textareaClass} min-h-16`} /></label>
    </>
  );
}

export async function BenefitsPage() {
  const [data, timeZone] = await Promise.all([getBenefits(), getSalonTimezone()]);
  if (!data) return <PlatformPage breadcrumbs={[{ type: 'page', label: 'Memberships & packages' }]}><ErrorState id="benefits-error" title="Benefits couldn't be loaded" message="Check your catalog and client access, then reload." action={null} /></PlatformPage>;
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : '—';
  const activeMembers = data.clientMemberships.filter((item) => item.status === 'active').length;
  const activePackages = data.clientPackages.filter((item) => item.status === 'active');
  const remaining = activePackages.reduce((sum, item) => sum + Math.max(0, item.totalValue - (item.usedValue || 0)), 0);
  const sellable = [
    ...data.memberships.filter((plan) => plan.isActive).map((plan) => ({ value: `membership:${plan.id}`, label: `${plan.name} · ${usd(plan.monthlyPrice)}/mo` })),
    ...data.servicePackages.filter((plan) => plan.isActive).map((plan) => ({ value: `package:${plan.id}`, label: `${plan.name} · ${usd(plan.totalPrice)}` })),
  ];

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Memberships & packages' }]}>
      <PageHeader icon={Gift} title="Memberships & packages" status={<TitleStatus tone="emerald">{activeMembers} active members</TitleStatus>} actions={<Track><PillLink href="/dashboard/platform/gift-cards" variant="quiet">Gift cards</PillLink></Track>} />
      <MetricStrip items={[
        { label: 'Active members', value: activeMembers, tone: 'emerald' },
        { label: 'Active packages', value: activePackages.length },
        { label: 'Prepaid value left', value: usd(remaining) },
        { label: 'Plans on sale', value: sellable.length },
      ]} />

      <Panel title="Sell or enrol" icon={UserPlus}>
        {sellable.length === 0 || data.accounts.length === 0 ? <p className="text-sm text-muted-foreground">{sellable.length === 0 ? 'Create a plan below first.' : 'The client needs an account. Add the client first.'}</p> : (
          <ActionForm action={sellBenefit} submitLabel="Record sale" pendingLabel="Recording…" resetOnSuccess>
            <input type="hidden" name="idempotencyKey" value={`benefit-sale:${randomUUID()}`} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={fieldLabelClass}>Client<select name="clientUserId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
              <label className={fieldLabelClass}>Plan<select name="plan" required defaultValue="" className={inputClass}><option value="" disabled>Choose a plan</option>{sellable.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></label>
              <label className={fieldLabelClass}>Paid by<select name="paymentMethod" required defaultValue="" className={inputClass}><option value="" disabled>Choose tender</option><option value="credit_card">Card · external terminal</option><option value="cash">Cash</option></select></label>
            </div>
          </ActionForm>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanList kind="membership" title="Membership plans" plans={data.memberships} services={data.services} />
        <PlanList kind="package" title="Packages" plans={data.servicePackages} services={data.services} />
      </div>

      <Panel title="Members" icon={Sparkles} padded={false}>
        {data.clientMemberships.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No members yet.</p> : (
          <ul className="divide-y">
            {data.clientMemberships.map((item) => (
              <li key={item.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-medium">{item.client?.name || item.client?.email || 'Client'}</span><TitleStatus tone={statusTone[item.status || ''] || 'zinc'}>{labelize(item.status)}{item.status === 'paused' && item.pausedUntil ? ` until ${date(item.pausedUntil)}` : ''}</TitleStatus></span>
                  <span className="block truncate text-xs text-muted-foreground">{item.membership?.name} · since {date(item.startDate)}{item.nextBillingDate && item.status === 'active' ? ` · renews ${date(item.nextBillingDate)}` : ''}</span>
                </span>
                {item.status !== 'cancelled' ? (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {item.status === 'active' ? (
                      <ActionForm action={setBenefitStatus} submitLabel="Pause" variant="raised" className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="paused" />
                        <label><span className="sr-only">Pause until</span><input name="pausedUntil" type="date" required className={`${inputClass} h-8 w-36 text-xs`} /></label>
                      </ActionForm>
                    ) : (
                      <ActionForm action={setBenefitStatus} submitLabel="Resume" variant="raised" className="contents"><input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="active" /></ActionForm>
                    )}
                    <ActionForm action={setBenefitStatus} submitLabel="Cancel" confirm="Cancel membership" variant="danger" className="contents"><input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Packages sold" icon={Package} padded={false}>
        {data.clientPackages.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No packages sold yet.</p> : (
          <ul className="divide-y">
            {data.clientPackages.map((item) => (
              <li key={item.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-medium">{item.client?.name || item.client?.email || 'Client'}</span><TitleStatus tone={statusTone[item.status || ''] || 'zinc'}>{labelize(item.status?.replace('-', ' '))}</TitleStatus></span>
                  <span className="block truncate text-xs text-muted-foreground">{item.package?.name} · {usd(Math.max(0, item.totalValue - (item.usedValue || 0)))} of {usd(item.totalValue)} left · expires {date(item.expiresAt)}</span>
                </span>
                {item.status === 'active' ? <ActionForm action={setBenefitStatus} submitLabel="Cancel" confirm="Cancel package" variant="danger" className="contents"><input type="hidden" name="kind" value="package" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">Members and package holders redeem at <Link href="/dashboard/platform/checkout" className="underline-offset-4 hover:underline">Checkout</Link>.</p>
    </PlatformPage>
  );
}

function PlanList({ kind, title, plans, services }: { kind: 'membership' | 'package'; title: string; plans: Array<MembershipPlan | PackagePlan>; services: { id: string; name: string }[] }) {
  return (
    <Panel title={title} icon={kind === 'membership' ? Sparkles : Package} padded={false}>
      {plans.length === 0 ? <div className="p-5"><EmptyState icon={kind === 'membership' ? Sparkles : Package} title={`No ${kind === 'membership' ? 'membership plans' : 'packages'} yet`} /></div> : (
        <ul className="divide-y">
          {plans.map((plan) => {
            const price = kind === 'membership' ? `${usd((plan as MembershipPlan).monthlyPrice)}/mo · ${(plan as MembershipPlan).discountPercent || 0}% off` : `${usd((plan as PackagePlan).totalPrice)} · ${(plan as PackagePlan).validDays ? `${(plan as PackagePlan).validDays} days` : 'no expiry'}`;
            const covered = (kind === 'membership' ? (plan as MembershipPlan).includedServices : (plan as PackagePlan).services).map((service) => service.name).filter(Boolean).join(', ');
            return (
              <li key={plan.id} className="px-4 py-3 md:px-5">
                <details>
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium">{plan.name}</span><TitleStatus tone={plan.isActive ? 'emerald' : 'zinc'}>{plan.isActive ? 'On sale' : 'Not on sale'}</TitleStatus></span>
                    <span className="block text-xs text-muted-foreground">{price}{covered ? ` · ${covered}` : ''}</span>
                  </summary>
                  <div className="mt-3"><ActionForm action={savePlan} submitLabel="Save plan"><PlanFields kind={kind} plan={plan} services={services} /></ActionForm></div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <details className="border-t px-4 py-3 md:px-5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden"><Plus className="size-4" />New {kind === 'membership' ? 'membership plan' : 'package'}</summary>
        <div className="mt-3"><ActionForm action={savePlan} submitLabel="Create plan" resetOnSuccess><PlanFields kind={kind} services={services} /></ActionForm></div>
      </details>
    </Panel>
  );
}

export default BenefitsPage;
