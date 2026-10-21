'use client';

import { useRouter } from 'next/navigation';

export function RetryCheckoutWorkflowButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      aria-label="Retry loading checkout"
      className="mt-4 inline-flex min-h-10 items-center justify-center border border-amber-900 bg-background px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Retry checkout
    </button>
  );
}
