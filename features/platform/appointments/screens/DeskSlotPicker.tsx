'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClass } from '../../components/pill';
import type { BookingSlot } from '@/features/storefront/lib/data/availability';

/*
 * Front-desk date and slot picker in the platform's own control language:
 * a strip of the next two weeks, a date field for anything further out, and
 * open times grouped by part of day. It is always visible; until the booking
 * has what it needs, it shows why instead of slots.
 */

const STRIP_DAYS = 14;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function inputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function slotPeriod(label: string) {
  const match = label.match(/(\d{1,2})(?::\d{2})?\s*([AaPp])\.?[Mm]/);
  if (!match) return 'Times';
  const hour = (Number(match[1]) % 12) + (match[2].toLowerCase() === 'p' ? 12 : 0);
  return hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
}

const choiceClass = 'inline-flex select-none items-center justify-center rounded-[6px] border text-sm transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45';
const choiceIdle = 'border-border bg-background hover:border-foreground/30 hover:bg-muted/60';
const choiceOn = 'border-foreground bg-foreground text-background';

export function DeskSlotPicker({
  date,
  onDateSelect,
  time,
  onTimeSelect,
  slots,
  loading,
  failed = false,
  onRetry,
  blockedReason,
}: {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  time: string | null;
  onTimeSelect: (startTime: string) => void;
  slots: BookingSlot[];
  loading: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** When set, the picker shows dates but explains why times can't load yet. */
  blockedReason?: string | null;
}) {
  // "Today" is the browser's day, so the strip is built after mount to avoid a server/client mismatch.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => { setToday(startOfDay(new Date())); }, []);
  const strip = useMemo(() => (today ? Array.from({ length: STRIP_DAYS }, (_, index) => addDays(today, index)) : []), [today]);
  const outsideStrip = Boolean(date && strip.length && !strip.some((day) => sameDay(day, date)));
  const groups = useMemo(() => {
    const ordered: Array<{ label: string; slots: BookingSlot[] }> = [];
    for (const slot of slots) {
      const label = slotPeriod(slot.label);
      const existing = ordered.find((group) => group.label === label);
      if (existing) existing.slots.push(slot);
      else ordered.push({ label, slots: [slot] });
    }
    return ordered;
  }, [slots]);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Date</span>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Other date
            <input
              type="date"
              min={today ? inputValue(today) : undefined}
              max={today ? inputValue(addDays(today, 90)) : undefined}
              value={date && outsideStrip ? inputValue(date) : ''}
              onChange={(event) => {
                const [y, m, d] = event.currentTarget.value.split('-').map(Number);
                onDateSelect(y && m && d ? new Date(y, m - 1, d) : undefined);
              }}
              className={cn(inputClass, 'h-9 w-[9.5rem] tabular-nums')}
            />
          </label>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" aria-busy={today === null}>
          <div className="flex min-w-max gap-1.5" role="group" aria-label="Next two weeks">
            {today === null
              ? Array.from({ length: 7 }, (_, index) => <span key={index} aria-hidden="true" className="h-14 w-12 rounded-[6px] border bg-muted/40" />)
              : strip.map((day, index) => {
                const selected = Boolean(date && sameDay(day, date));
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-pressed={selected}
                    aria-label={day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    onClick={() => onDateSelect(day)}
                    className={cn(choiceClass, 'h-14 w-12 flex-col gap-0.5 leading-none', selected ? choiceOn : choiceIdle)}
                  >
                    <span className={cn('text-[10px] font-medium uppercase', selected ? 'text-background/75' : 'text-muted-foreground')}>{index === 0 ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="text-base font-semibold tabular-nums">{day.getDate()}</span>
                  </button>
                );
              })}
          </div>
        </div>
        {date ? <p className="text-sm font-medium">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p> : null}
      </div>

      <div className="grid min-w-0 gap-2">
        <span className="text-xs font-medium text-muted-foreground">Time</span>
        {blockedReason ? (
          <Well>{blockedReason}</Well>
        ) : !date ? (
          <Well>Choose a date</Well>
        ) : loading ? (
          <div role="status" className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5" aria-label="Loading open times">
            {Array.from({ length: 8 }, (_, index) => <span key={index} className="h-9 animate-pulse rounded-[6px] bg-muted" />)}
          </div>
        ) : failed ? (
          <Well tone="alert">Availability couldn&apos;t be checked.{onRetry ? <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry</button> : null}</Well>
        ) : slots.length === 0 ? (
          <Well><Clock className="size-4" />No openings this day</Well>
        ) : (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div key={group.label} className="grid gap-1.5">
                {groups.length > 1 || group.label !== 'Times' ? <span className="text-[11px] font-medium text-muted-foreground">{group.label}</span> : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5" role="group" aria-label={`${group.label} times`}>
                  {group.slots.map((slot) => {
                    const selected = time === slot.startTime;
                    return (
                      <button key={slot.startTime} type="button" aria-pressed={selected} onClick={() => onTimeSelect(slot.startTime)} className={cn(choiceClass, 'h-9 px-2 font-medium tabular-nums', selected ? choiceOn : choiceIdle)}>
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Well({ children, tone }: { children: ReactNode; tone?: 'alert' }) {
  return (
    <div role={tone === 'alert' ? 'alert' : undefined} className={cn('flex min-h-16 items-center justify-center gap-2 rounded-[6px] border border-dashed px-3 text-center text-sm', tone === 'alert' ? 'border-amber-300 text-amber-800 dark:border-amber-900 dark:text-amber-300' : 'text-muted-foreground')}>
      {children}
    </div>
  );
}
