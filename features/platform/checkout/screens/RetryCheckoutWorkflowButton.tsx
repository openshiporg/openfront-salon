'use client';

import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { pillClass, trackClass } from '../../components/pill';

export function RetryCheckoutWorkflowButton() {
  const router = useRouter();

  return (
    <div className={trackClass}>
    <button
      type="button"
      onClick={() => router.refresh()}
      aria-label="Retry loading checkout"
      className={pillClass('primary')}
    >
      <RotateCw />
      Retry checkout
    </button>
    </div>
  );
}
