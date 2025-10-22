// components/RefreshOnActionComplete.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';

/**
 * Watches the nearest <form> in the subtree. When its server action
 * goes from pending -> settled, we call router.refresh() to pull
 * fresh server data without navigating away.
 */
export default function RefreshOnActionComplete() {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (wasPending.current && !pending) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router]);

  return null;
}
