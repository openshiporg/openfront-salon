'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { fieldLabelClass, inputClass, pillClass } from '../../components/pill';

type Shift = { id: string; revision: number; label: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={pillClass('danger', 'sm')}>{pending ? 'Blocking…' : 'Block every week'}</button>;
}

/** One row action for the week grid: pick a weekly shift and block it, instead of a button in every cell. */
export function BlockDayMenu({ stylistName, shifts, action }: { stylistName: string; shifts: Shift[]; action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [shiftId, setShiftId] = useState(shifts[0]?.id || '');
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const shift = shifts.find((item) => item.id === shiftId) || shifts[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', dismiss);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); window.removeEventListener('resize', dismiss); };
  }, [open]);

  if (!shift) return null;

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button type="button" aria-expanded={open} aria-label={`Block a weekly shift for ${stylistName}`} ref={trigger} onClick={() => {
        const rect = trigger.current?.getBoundingClientRect();
        if (rect) setPosition({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
        setOpen((value) => !value);
      }} className={pillClass('quiet', 'sm')}>
        Block<ChevronDown />
      </button>
      {open ? (
        <form
          action={async (formData) => { await action(formData); setOpen(false); }}
          style={{ top: position.top, right: position.right }}
          className="fixed z-50 grid w-60 max-w-[calc(100vw-16px)] gap-2.5 rounded-[6px] border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <input type="hidden" name="id" value={shift.id} />
          <input type="hidden" name="revision" value={shift.revision} />
          <input type="hidden" name="isAvailable" value="false" />
          <label className={fieldLabelClass}>Shift
            <select value={shift.id} onChange={(event) => setShiftId(event.target.value)} className={inputClass}>
              {shifts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>Reason<input name="reason" className={inputClass} /></label>
          <div><SubmitButton /></div>
        </form>
      ) : null}
    </div>
  );
}
