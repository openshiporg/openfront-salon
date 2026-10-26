'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { adjustPoints, type PointsRecord } from '../actions/loyalty';
import { ActionForm } from '../../components/ActionForm';
import { fieldLabelClass, inputClass, labelize, pillClass, tableClass, tdClass, thClass } from '../../components/pill';

/** Loyalty's first view: find a client's balance and add or redeem points beside it. */
export function LoyaltyDesk({ points, accounts, timeZone }: { points: PointsRecord[]; accounts: { id: string; label: string }[]; timeZone?: string }) {
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const needle = query.trim().toLowerCase();
  const rows = points.filter((record) => !needle || [record.client?.name, record.client?.email].some((value) => value?.toLowerCase().includes(needle)));
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone }) : '—';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section aria-labelledby="balances" className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="balances" className="text-sm font-semibold">Balances</h2>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Find a client</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a client by name or email" className={`${inputClass} pl-8`} />
          </label>
        </div>
        <div className="min-w-0 relative overflow-x-auto rounded-[6px] border bg-background">
          <table className={tableClass} aria-labelledby="balances">
            <thead><tr><th scope="col" className={thClass}>Client</th><th scope="col" className={thClass}>Tier</th><th scope="col" className={`${thClass} text-right`}>Points</th><th scope="col" className={`${thClass} hidden md:table-cell`}>Last activity</th><th scope="col" className={`${thClass} w-px`}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={5} className={`${tdClass} py-4 text-muted-foreground`}>{needle ? 'No client with points matches.' : 'No client has points yet.'}</td></tr> : rows.map((record) => {
                const last = (record.transactions || []).at(-1);
                const selected = Boolean(record.client?.id) && record.client?.id === userId;
                return (
                  <tr key={record.id} className={selected ? 'bg-muted/40' : 'hover:bg-muted/20'}>
                    <td className={tdClass}><span className="font-medium">{record.client?.name || record.client?.email || 'Client'}</span>{record.client?.name && record.client.email ? <span className="block text-xs text-muted-foreground">{record.client.email}</span> : null}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{labelize(record.tier) || 'Bronze'}</td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums`}>{new Intl.NumberFormat('en-US').format(record.points)}</td>
                    <td className={`${tdClass} hidden text-muted-foreground md:table-cell`}>{last ? `${last.points > 0 ? '+' : ''}${last.points} · ${last.reason || labelize(last.source)} · ${date(last.at)}` : 'No activity'}</td>
                    <td className={`${tdClass} text-right`}>{record.client?.id && accounts.some((account) => account.id === record.client?.id) ? <button type="button" aria-pressed={selected} onClick={() => setUserId(record.client!.id)} className={pillClass(selected ? 'raised' : 'quiet', 'sm')}>Adjust</button> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="adjust-points" className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
        <div className="flex min-h-10 items-center border-b bg-muted/30 px-4 py-1.5"><h2 id="adjust-points" className="text-[13px] font-semibold">Add or redeem points</h2></div>
        <div className="p-4">
          {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No client accounts yet.</p> : (
            <ActionForm action={adjustPoints} submitLabel="Apply" resetOnSuccess size="md">
              <label className={fieldLabelClass}>Client<select name="userId" required value={userId} onChange={(event) => setUserId(event.target.value)} className={inputClass}><option value="" disabled>Choose a client</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={fieldLabelClass}>Action<select name="direction" className={inputClass}><option value="redeem">Redeem</option><option value="add">Add</option></select></label>
                <label className={fieldLabelClass}>Points<input name="points" type="number" min="1" step="1" required inputMode="numeric" className={`${inputClass} tabular-nums`} /></label>
              </div>
              <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={500} className={inputClass} /></label>
            </ActionForm>
          )}
        </div>
      </section>
    </div>
  );
}
