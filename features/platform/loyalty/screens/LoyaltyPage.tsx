import { Award, HeartHandshake, Settings2 } from 'lucide-react';
import { adjustPoints, createReferral, finishReferral, getLoyalty, saveProgram } from '../actions/loyalty';
import { ActionForm } from '../../components/ActionForm';
import { ErrorState, fieldLabelClass, inputClass, labelize, MetricStrip, PageHeader, Panel, PlatformPage, TitleStatus, usd } from '../../components/salon-ui';
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
      <PageHeader icon={Award} title="Loyalty" status={<TitleStatus tone={program?.isActive ? 'emerald' : 'zinc'}>{program?.isActive ? 'Earning on' : 'Not running'}</TitleStatus>} />
      <MetricStrip items={[
        { label: 'Members with points', value: data.points.filter((record) => record.points > 0).length },
        { label: 'Points outstanding', value: new Intl.NumberFormat('en-US').format(outstanding) },
        { label: 'Liability', value: usd(Math.round(outstanding * Number(program?.redemptionRate || 0) * 100)) },
        { label: 'Pending referrals', value: data.referrals.filter((item) => item.status === 'pending').length },
      ]} />

      <Panel title="Program" icon={Settings2}>
        <ActionForm action={saveProgram} submitLabel={program ? 'Save program' : 'Start program'}>
          {program ? <input type="hidden" name="id" value={program.id} /> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={fieldLabelClass}>Name<input name="name" required maxLength={200} defaultValue={program?.name || 'Rewards'} className={inputClass} /></label>
            <label className={fieldLabelClass}>Points per $1 spent<input name="pointsPerDollar" type="number" min="0" max="100" step="0.1" required defaultValue={program?.pointsPerDollar ?? 1} className={inputClass} /></label>
            <label className={fieldLabelClass}>Point value (cents)<input name="centsPerPoint" type="number" min="0" max="100" step="0.1" required defaultValue={program ? Number((program.redemptionRate * 100).toFixed(2)) : 1} className={inputClass} /></label>
            <label className="flex min-h-10 items-center gap-2 self-end rounded-xl border bg-background px-3 text-sm"><input type="checkbox" name="isActive" value="true" defaultChecked={program?.isActive !== false} className="h-4 w-4 accent-foreground" />Clients earn at checkout</label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Tiers</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                  <input name="tierName" aria-label={`Tier ${index + 1} name`} placeholder={['Bronze', 'Silver', 'Gold', 'Platinum'][index] || 'Tier'} defaultValue={tier.name} maxLength={40} className={`${inputClass} h-9`} />
                  <input name="tierMin" aria-label={`Tier ${index + 1} from points`} type="number" min="0" step="1" defaultValue={tier.name ? tier.minPoints : ''} placeholder="From" className={`${inputClass} h-9`} />
                </div>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Balances" icon={Award} padded={false}>
          {data.points.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No client has points yet.</p> : (
            <ul className="divide-y">
              {data.points.map((record) => {
                const last = (record.transactions || []).at(-1);
                return (
                  <li key={record.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-medium">{record.client?.name || record.client?.email || 'Client'}</span><TitleStatus tone="violet">{labelize(record.tier) || 'Bronze'}</TitleStatus></span>
                      <span className="block truncate text-xs text-muted-foreground">{last ? `${last.points > 0 ? '+' : ''}${last.points} · ${last.reason || labelize(last.source)} · ${date(last.at)}` : 'No activity'}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{new Intl.NumberFormat('en-US').format(record.points)} pts</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Add or redeem points">
          {data.accounts.length === 0 ? <p className="text-sm text-muted-foreground">No client accounts yet.</p> : (
            <ActionForm action={adjustPoints} submitLabel="Apply" resetOnSuccess>
              <label className={fieldLabelClass}>Client<select name="userId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={fieldLabelClass}>Action<select name="direction" className={inputClass}><option value="redeem">Redeem</option><option value="add">Add</option></select></label>
                <label className={fieldLabelClass}>Points<input name="points" type="number" min="1" step="1" required inputMode="numeric" className={inputClass} /></label>
              </div>
              <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={500} className={inputClass} /></label>
            </ActionForm>
          )}
        </Panel>
      </div>

      <Panel title="Referrals" icon={HeartHandshake} padded={false}>
        {data.accounts.length > 1 ? (
          <div className="border-b p-4 md:p-5">
            <ActionForm action={createReferral} submitLabel="Record referral" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={fieldLabelClass}>Referred by<select name="referrerId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
                <label className={fieldLabelClass}>New client<select name="referredId" required defaultValue="" className={inputClass}><option value="" disabled>Choose a client</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
                <label className={fieldLabelClass}>Reward (points)<input name="rewardAmount" type="number" min="0" step="1" defaultValue={100} className={inputClass} /></label>
              </div>
            </ActionForm>
          </div>
        ) : null}
        {data.referrals.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No referrals yet.</p> : (
          <ul className="divide-y">
            {data.referrals.map((item) => (
              <li key={item.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-medium">{item.referrer?.name || item.referrer?.email} → {item.referred?.name || item.referred?.email}</span><TitleStatus tone={item.status === 'completed' ? 'emerald' : item.status === 'pending' ? 'amber' : 'zinc'}>{labelize(item.status)}</TitleStatus></span>
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
