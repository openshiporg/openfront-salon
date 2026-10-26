'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { pillClass } from '../../components/pill';

export function RetryClientsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={pillClass('primary')}>
      <RotateCw />{pending ? 'Retrying…' : 'Retry'}
    </button>
  );
}
