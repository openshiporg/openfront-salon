import { HeartHandshake, Settings2 } from 'lucide-react';
import { createReferral, finishReferral, getLoyalty, saveProgram } from '../actions/loyalty';
import { LoyaltyDesk } from './LoyaltyDesk';
import { ActionForm } from '../../components/ActionForm';
import { ErrorState, fieldLabelClass, inputClass, labelize, PageHeader, Panel, PlatformPage, StatusCell, TitleStatus, usd } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

export async function LoyaltyPage() {
  const [data, timeZone] = await Promise.all([getLoyalty(), getSalonTimezone()]);
  if (!data) return <PlatformPage breadcrumbs={[{ type: 'page', label: 'Loyalty' }]}><ErrorState id="loyalty-error" title="Loyalty couldn't be loaded" message="Check your client access, then reload." action={null} /></PlatformPage>;
  const { program } = data;
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : '—';
  const outstanding = data.points.reduce((sum, record) => sum + record.points, 0);
  const tiers = [...(program?.tiers || []), ...Array.from({ length: Math.max(0, 4 - (program?.tiers?.length || 0)) }, () => ({ name: '', minPoints: 0 }))];

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Loyalty' }]}>
      <PageHeader
        title="Loyalty"
        status={<TitleStatus tone={program?.isActive ? 'emerald' : 'zinc'}>{program?.isActive ? 'Earning on' : 'Not running'}</TitleStatus>}
        meta={<span>{data.points.filter((record) => record.points > 0).length} members with points · {new Intl.NumberFormat('en-US').format(outstanding)} points outstanding · {usd(Math.round(outstanding * Number(program?.redemptionRate || 0) * 100))} liability</span>}
      />

      <LoyaltyDesk points={data.points} accounts={data.accounts} timeZone={timeZone} />

      <Panel title="Program setup" icon={Settings2}>
        <ActionForm action={saveProgram} submitLabel={program ? 'Save program' : 'Start program'}>
          {program ? <input type="hidden" name="id" value={program.id} /> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={fieldLabelClass}>Name<input name="name" required maxLength={200} defaultValue={program?.name || 'Rewards'} className={inputClass} /></label>
            <label className={fieldLabelClass}>Points per $1 spent<input name="pointsPerDollar" type="number" min="0" max="100" step="0.1" required defaultValue={program?.pointsPerDollar ?? 1} className={inputClass} /></label>
            <label className={fieldLabelClass}>Point value (cents)<input name="centsPerPoint" type="number" min="0" max="100" step="0.1" required defaultValue={program ? Number((program.redemptionRate * 100).toFixed(2)) : 1} className={inputClass} /></label>
            <label className="flex h-9 items-center gap-2 self-end rounded-[6px] border bg-background px-2.5 text-sm"><input type="checkbox" name="isActive" value="true" defaultChecked={program?.isActive !== false} className="size-4 accent-foreground" />Clients earn at checkout</label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold text-foreground">Tiers</legend>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                  <label className={fieldLabelClass}>Tier {index + 1} name<input name="tierName" placeholder={['Bronze', 'Silver', 'Gold', 'Platinum'][index] || 'Tier'} defaultValue={tier.name} maxLength={40} className={inputClass} /></label>
                  <label className={fieldLabelClass}>From points<input name="tierMin" type="number" min="0" step="1" defaultValue={tier.name ? tier.minPoints : ''} placeholder="0" className={`${inputClass} tabular-nums`} /></label>
                </div>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Panel>

      <Panel title="Referrals" icon={HeartHandshake} padded={false}>
        {data.accounts.length > 1 ? (
          <div className="border-b p-4">
            <ActionForm action={createReferral} submitLabel="Record referral" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={fieldLabelClass}>Referred by<select name="referrerId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
                <label className={fieldLabelClass}>New client<select name="referredId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
                <label className={fieldLabelClass}>Reward (points)<input name="rewardAmount" type="number" min="0" step="1" defaultValue={100} className={inputClass} /></label>
              </div>
            </ActionForm>
          </div>
        ) : null}
        {data.referrals.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No referrals yet.</p> : (
          <ul className="divide-y">
            {data.referrals.map((item) => (
              <li key={item.id} className="grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-medium">{item.referrer?.name || item.referrer?.email} → {item.referred?.name || item.referred?.email}</span><StatusCell tone={item.status === 'completed' ? 'emerald' : item.status === 'pending' ? 'amber' : 'zinc'}>{labelize(item.status)}</StatusCell></span>
                  <span className="block text-xs text-muted-foreground">{item.rewardAmount} {item.rewardType === 'credit' ? 'credit' : 'points'} · {item.status === 'completed' ? `completed ${date(item.completedAt)}` : `recorded ${date(item.createdAt)}`}</span>
                </span>
                {item.status === 'pending' ? <ActionForm action={finishReferral} submitLabel="Complete & reward" className="contents"><input type="hidden" name="id" value={item.id} /></ActionForm> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PlatformPage>
  );
}

export default LoyaltyPage;
