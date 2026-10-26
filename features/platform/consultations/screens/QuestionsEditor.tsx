'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { inputClass, pillClass, trackClass } from '../../components/pill';

type Row = { id?: string; label: string; required: boolean };

/** Question rows for a new form version, serialized into the hidden `questions` field. */
export function QuestionsEditor({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ label: '', required: true }]);
  const update = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Questions</legend>
      <input type="hidden" name="questions" value={JSON.stringify(rows.map(({ id, label, required }) => ({ id, label, required, type: 'text' })))} />
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <input aria-label={`Question ${index + 1}`} value={row.label} onChange={(event) => update(index, { label: event.target.value })} maxLength={500} className={`${inputClass} h-9`} />
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={row.required} onChange={(event) => update(index, { required: event.target.checked })} className="size-4 accent-foreground" />Required</label>
          <button type="button" aria-label={`Remove question ${index + 1}`} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={rows.length === 1} className="inline-flex size-9 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"><X className="size-4" /></button>
        </div>
      ))}
      <div className={`${trackClass} justify-self-start`}><button type="button" onClick={() => setRows((current) => [...current, { label: '', required: false }])} className={pillClass('quiet', 'sm')}><Plus />Add question</button></div>
    </fieldset>
  );
}
