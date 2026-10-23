'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { addClientNote, addColorFormula, type CareFormState } from '../actions/clientProfile';
import { fieldLabelClass, inputClass, pillClass, textareaClass, trackClass } from '../../components/pill';

const idle: CareFormState = { status: 'idle', message: '' };

function Feedback({ state }: { state: CareFormState }) {
  if (state.status === 'idle') return null;
  return <p role={state.status === 'success' ? 'status' : 'alert'} className={`text-sm ${state.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{state.message}</p>;
}

function useResetOnSuccess(state: CareFormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === 'success') ref.current?.reset(); }, [state]);
  return ref;
}

export function ClientNoteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState(addClientNote, idle);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <label className={fieldLabelClass}>New note<textarea name="content" required maxLength={5000} className={textareaClass} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}><button type="submit" disabled={pending} className={pillClass('primary', 'sm')}><Plus />{pending ? 'Saving…' : 'Add note'}</button></div>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ColorFormulaForm({ clientId, stylists }: { clientId: string; stylists: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addColorFormula, idle);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={fieldLabelClass}>Formula name<input name="formulaName" required maxLength={200} className={inputClass} /></label>
        <label className={fieldLabelClass}>Colorist
          <select name="stylistId" defaultValue="" className={inputClass}>
            <option value="">Not recorded</option>
            {stylists.map((stylist) => <option key={stylist.id} value={stylist.id}>{stylist.name}</option>)}
          </select>
        </label>
        <label className={fieldLabelClass}>Processing time (min)<input name="processingTime" type="number" min="0" max="600" inputMode="numeric" className={inputClass} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={fieldLabelClass}>Products<textarea name="products" maxLength={5000} className={textareaClass} /></label>
        <label className={fieldLabelClass}>Measurements<textarea name="measurements" maxLength={5000} className={textareaClass} /></label>
        <label className={fieldLabelClass}>Result<textarea name="result" maxLength={5000} className={textareaClass} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}><button type="submit" disabled={pending} className={pillClass('primary', 'sm')}><Plus />{pending ? 'Saving…' : 'Save formula'}</button></div>
        <Feedback state={state} />
      </div>
    </form>
  );
}
