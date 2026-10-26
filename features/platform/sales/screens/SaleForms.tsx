'use client';

import { useActionState, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { adjustCompensation, reverseSale } from '../actions/sales';
import type { FormState } from '@/features/platform/lib/formState';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';

const idle: FormState = { status: 'idle', message: '' };
const money = (cents: number) => (cents / 100).toFixed(2);

function Feedback({ state }: { state: FormState }) {
  if (state.status === 'idle') return null;
  return <p role={state.status === 'success' ? 'status' : 'alert'} className={`text-sm ${state.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{state.message}</p>;
}

export type RefundableLine = { id: string; title: string; isProduct: boolean; remaining: number; unitNet: number };

/** Full refund or void returns every remaining line and tip; partial picks lines and quantities. */
export function RefundForm({ transactionId, lines, remainingTip, packageCredit, idempotencyKey }: { transactionId: string; lines: RefundableLine[]; remainingTip: number; packageCredit: number; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(reverseSale, idle);
  const [mode, setMode] = useState<'refund' | 'void' | 'partial'>('refund');
  const [armed, setArmed] = useState(false);
  const full = mode !== 'partial';
  if (!lines.length) return <p className="text-sm text-muted-foreground">Everything on this sale has been refunded.</p>;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="idempotencyKey" value={`${idempotencyKey}:${mode}`} />
      <fieldset className="inline-flex justify-self-start overflow-hidden rounded-[6px] border text-xs font-medium">
        <legend className="sr-only">Refund type</legend>
        {(['refund', 'partial', 'void'] as const).map((value, index) => (
          <label key={value} className={`inline-flex h-8 cursor-pointer select-none items-center px-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring ${index > 0 ? 'border-l' : ''} ${mode === value ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            <input type="radio" name="refundTypeChoice" value={value} checked={mode === value} onChange={() => { setMode(value); setArmed(false); }} className="sr-only" />
            {value === 'refund' ? 'Full refund' : value === 'partial' ? 'Partial refund' : 'Void'}
          </label>
        ))}
      </fieldset>
      <ul className="divide-y rounded-[6px] border">
        {lines.map((line) => (
          <li key={line.id} className="grid min-w-0 gap-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_10rem] sm:items-center">
            <input type="hidden" name="lineId" value={line.id} />
            <span className="min-w-0 truncate font-medium">{line.title}<span className="block text-xs font-normal text-muted-foreground">{line.remaining} refundable · ${money(line.unitNet)} each</span></span>
            {full ? <input type="hidden" name={`quantity.${line.id}`} value={line.remaining} /> : (
              <label className={fieldLabelClass}><span className="sm:sr-only">Quantity</span><input name={`quantity.${line.id}`} type="number" min={0} max={line.remaining} defaultValue={0} inputMode="numeric" className={`${inputClass} h-9`} /></label>
            )}
            {line.isProduct ? (
              <label className={fieldLabelClass}><span className="sm:sr-only">Returned item</span>
                <select name={`disposition.${line.id}`} defaultValue="return_to_stock" className={`${inputClass} h-9`}>
                  <option value="return_to_stock">Back to stock</option>
                  <option value="damaged">Damaged</option>
                  <option value="consumed">Used</option>
                </select>
              </label>
            ) : <input type="hidden" name={`disposition.${line.id}`} value="not_applicable" />}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        {full ? <input type="hidden" name="tip" value={money(remainingTip)} /> : (
          <label className={fieldLabelClass}>Tip to refund<input name="tip" type="number" min="0" max={money(remainingTip)} step="0.01" defaultValue="0.00" inputMode="decimal" className={inputClass} /></label>
        )}
        {packageCredit > 0 ? <label className={fieldLabelClass}>Restore package value<input name="restorePackage" type="number" min="0" max={money(packageCredit)} step="0.01" defaultValue="0.00" inputMode="decimal" className={inputClass} /></label> : null}
        <label className={`${fieldLabelClass} sm:col-span-2`}>Reason<input name="reason" required maxLength={1000} className={inputClass} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          {!armed ? <button type="button" onClick={() => setArmed(true)} className={pillClass('danger', 'sm')}><RotateCcw />{mode === 'void' ? 'Void sale' : 'Refund'}</button> : (
            <>
              <button type="button" onClick={() => setArmed(false)} disabled={pending} className={pillClass('quiet', 'sm')}>Cancel</button>
              <button type="submit" disabled={pending} className={pillClass('danger', 'sm')}>{pending ? 'Posting…' : mode === 'void' ? 'Confirm void' : 'Confirm refund'}</button>
            </>
          )}
        </div>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function CompensationForm({ transactionId, commissions, tips, stylists }: {
  transactionId: string;
  commissions: { id: string; label: string }[];
  tips: { id: string; label: string }[];
  stylists: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(adjustCompensation, idle);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      {commissions.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={fieldLabelClass}>Commission<select name="commissionId" className={inputClass}>{commissions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className={fieldLabelClass}>Change<select name="direction" className={inputClass}><option value="decrease">Decrease</option><option value="increase">Increase</option></select></label>
          <label className={fieldLabelClass}>Amount<input name="commissionAmount" type="number" min="0" step="0.01" defaultValue="0.00" inputMode="decimal" className={inputClass} /></label>
        </div>
      ) : null}
      {tips.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={fieldLabelClass}>Move tip from<select name="sourceTipId" className={inputClass}>{tips.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className={fieldLabelClass}>To<select name="targetStylistId" className={inputClass}>{stylists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className={fieldLabelClass}>Amount<input name="tipAmount" type="number" min="0" step="0.01" defaultValue="0.00" inputMode="decimal" className={inputClass} /></label>
        </div>
      ) : null}
      <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={1000} className={inputClass} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}><button type="submit" disabled={pending} className={pillClass('primary', 'sm')}>{pending ? 'Posting…' : 'Post adjustment'}</button></div>
        <Feedback state={state} />
      </div>
    </form>
  );
}
