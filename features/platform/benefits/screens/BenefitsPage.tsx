import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { Gift, Package, Plus, Sparkles, UserPlus } from 'lucide-react';
import { getBenefits, savePlan, sellBenefit, setBenefitStatus, type MembershipPlan, type PackagePlan } from '../actions/benefits';
import { ActionForm } from '../../components/ActionForm';
import { DataTable, ErrorState, fieldLabelClass, inputClass, labelize, PageHeader, Panel, pillClass, PillLink, PlatformPage, StatusCell, Td, textareaClass, usd, type Tone } from '../../components/salon-ui';
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
        <label className="flex h-9 items-center gap-2 self-end rounded-[6px] border bg-background px-2.5 text-sm"><input type="checkbox" name="isActive" value="true" defaultChecked={plan?.isActive !== false} className="size-4 accent-foreground" />Available to sell</label>
      </div>
      <label className={fieldLabelClass}>{kind === 'membership' ? 'Services the discount covers' : 'Services in the package'}
        <select name="serviceIds" multiple defaultValue={selected} className="min-h-28 w-full rounded-[6px] border border-input bg-background px-2 py-2 text-sm text-foreground outline-none focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring/30">{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
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
      <PageHeader
        title="Memberships & packages"
        meta={<span>{activeMembers} active members · {activePackages.length} active packages · {usd(remaining)} prepaid left</span>}
        actions={<PillLink href="/dashboard/platform/gift-cards" variant="raised"><Gift />Gift cards</PillLink>}
      />

      <Panel title="Sell or enrol" icon={UserPlus}>
        {sellable.length === 0 || data.accounts.length === 0 ? <p className="text-sm text-muted-foreground">{sellable.length === 0 ? 'Create a plan below first.' : 'The client needs an account. Add the client first.'}</p> : (
          <ActionForm action={sellBenefit} submitLabel="Record sale" pendingLabel="Recording…" resetOnSuccess size="md">
            <input type="hidden" name="idempotencyKey" value={`benefit-sale:${randomUUID()}`} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={fieldLabelClass}>Client<select name="clientUserId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
              <label className={fieldLabelClass}>Plan<select name="plan" required defaultValue="" className={inputClass}><option value="" disabled>Choose a plan</option>{sellable.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></label>
              <label className={fieldLabelClass}>Paid by<select name="paymentMethod" required defaultValue="" className={inputClass}><option value="" disabled>Choose tender</option><option value="credit_card">Card · external terminal</option><option value="cash">Cash</option></select></label>
            </div>
          </ActionForm>
        )}
      </Panel>

      <section aria-labelledby="members" className="grid gap-2">
        <h2 id="members" className="flex items-baseline gap-2 text-sm font-semibold">Members<span className="text-xs font-normal tabular-nums text-muted-foreground">{data.clientMemberships.length}</span></h2>
        <DataTable label="Members" head={[{ label: 'Client' }, { label: 'Plan', className: 'hidden sm:table-cell' }, { label: 'Since', className: 'hidden md:table-cell' }, { label: 'Renews', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: 'Actions', className: 'text-right' }]}>
          {data.clientMemberships.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">No members yet.</Td></tr> : data.clientMemberships.map((item) => (
            <tr key={item.id}>
              <Td><span className="font-medium">{item.client?.name || item.client?.email || 'Client'}</span><span className="block text-xs text-muted-foreground sm:hidden">{item.membership?.name}</span></Td>
              <Td className="hidden sm:table-cell">{item.membership?.name}</Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{date(item.startDate)}</Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{item.nextBillingDate && item.status === 'active' ? date(item.nextBillingDate) : '—'}</Td>
              <Td><StatusCell tone={statusTone[item.status || ''] || 'zinc'}>{labelize(item.status)}{item.status === 'paused' && item.pausedUntil ? ` until ${date(item.pausedUntil)}` : ''}</StatusCell></Td>
              <Td>
                {item.status !== 'cancelled' ? (
                  <div className="flex flex-wrap items-start justify-end gap-1.5">
                    {item.status === 'active' ? (
                      <ActionForm action={setBenefitStatus} submitLabel="Pause" variant="raised" className="flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="paused" />
                        <label><span className="sr-only">Pause until</span><input name="pausedUntil" type="date" required className={`${inputClass} h-7 w-36 text-xs`} /></label>
                      </ActionForm>
                    ) : (
                      <ActionForm action={setBenefitStatus} submitLabel="Resume" variant="raised" className="contents"><input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="active" /></ActionForm>
                    )}
                    <ActionForm action={setBenefitStatus} submitLabel="Cancel" confirm="Cancel membership" variant="danger" className="contents"><input type="hidden" name="kind" value="membership" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section aria-labelledby="packages-sold" className="grid gap-2">
        <h2 id="packages-sold" className="flex items-baseline gap-2 text-sm font-semibold">Packages sold<span className="text-xs font-normal tabular-nums text-muted-foreground">{data.clientPackages.length}</span></h2>
        <DataTable label="Packages sold" head={[{ label: 'Client' }, { label: 'Package', className: 'hidden sm:table-cell' }, { label: 'Value left', className: 'text-right' }, { label: 'Expires', className: 'hidden md:table-cell' }, { label: 'Status' }, { label: 'Actions', className: 'text-right' }]}>
          {data.clientPackages.length === 0 ? <tr><Td colSpan={6} className="py-4 text-muted-foreground">No packages sold yet.</Td></tr> : data.clientPackages.map((item) => (
            <tr key={item.id}>
              <Td><span className="font-medium">{item.client?.name || item.client?.email || 'Client'}</span><span className="block text-xs text-muted-foreground sm:hidden">{item.package?.name}</span></Td>
              <Td className="hidden sm:table-cell">{item.package?.name}</Td>
              <Td className="whitespace-nowrap text-right tabular-nums">{usd(Math.max(0, item.totalValue - (item.usedValue || 0)))}<span className="block text-xs text-muted-foreground">of {usd(item.totalValue)}</span></Td>
              <Td className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:table-cell">{date(item.expiresAt)}</Td>
              <Td><StatusCell tone={statusTone[item.status || ''] || 'zinc'}>{labelize(item.status?.replace('-', ' '))}</StatusCell></Td>
              <Td className="text-right">{item.status === 'active' ? <ActionForm action={setBenefitStatus} submitLabel="Cancel" confirm="Cancel package" variant="danger" className="flex justify-end"><input type="hidden" name="kind" value="package" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm> : null}</Td>
            </tr>
          ))}
        </DataTable>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanList kind="membership" title="Membership plans" plans={data.memberships} services={data.services} />
        <PlanList kind="package" title="Packages" plans={data.servicePackages} services={data.services} />
      </div>

      <p className="text-xs text-muted-foreground">Members and package holders redeem at <Link href="/dashboard/platform/checkout" className="underline-offset-4 hover:underline">Checkout</Link>.</p>
    </PlatformPage>
  );
}

function PlanList({ kind, title, plans, services }: { kind: 'membership' | 'package'; title: string; plans: Array<MembershipPlan | PackagePlan>; services: { id: string; name: string }[] }) {
  return (
    <Panel title={title} icon={kind === 'membership' ? Sparkles : Package} padded={false}>
      {plans.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No {kind === 'membership' ? 'membership plans' : 'packages'} yet</p> : (
        <ul className="divide-y">
          {plans.map((plan) => {
            const price = kind === 'membership' ? `${usd((plan as MembershipPlan).monthlyPrice)}/mo · ${(plan as MembershipPlan).discountPercent || 0}% off` : `${usd((plan as PackagePlan).totalPrice)} · ${(plan as PackagePlan).validDays ? `${(plan as PackagePlan).validDays} days` : 'no expiry'}`;
            const covered = (kind === 'membership' ? (plan as MembershipPlan).includedServices : (plan as PackagePlan).services).map((service) => service.name).filter(Boolean).join(', ');
            return (
              <li key={plan.id} className="px-4 py-2.5">
                <details>
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium">{plan.name}</span><StatusCell tone={plan.isActive ? 'emerald' : 'zinc'}>{plan.isActive ? 'On sale' : 'Not on sale'}</StatusCell></span>
                    <span className="block text-xs text-muted-foreground">{price}{covered ? ` · ${covered}` : ''}</span>
                  </summary>
                  <div className="mt-3"><ActionForm action={savePlan} submitLabel="Save plan"><PlanFields kind={kind} plan={plan} services={services} /></ActionForm></div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <details className="border-t px-4 py-3">
        <summary className={`${pillClass('raised', 'sm')} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><Plus />New {kind === 'membership' ? 'membership plan' : 'package'}</summary>
        <div className="mt-3"><ActionForm action={savePlan} submitLabel="Create plan" resetOnSuccess><PlanFields kind={kind} services={services} /></ActionForm></div>
      </details>
    </Panel>
  );
}

export default BenefitsPage;
