'use client';

import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { pillClass, trackClass } from '../../components/pill';

export function RetryAppointmentQueueButton() {
  const router = useRouter();

  return (
    <div className={trackClass}>
    <button
      type="button"
      onClick={() => router.refresh()}
      aria-label="Retry loading the appointment queue"
      className={pillClass('primary')}
    >
      <RotateCw />
      Retry appointment queue
    </button>
    </div>
  );
}
