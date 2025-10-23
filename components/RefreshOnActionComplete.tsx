// components/RefreshOnActionComplete.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';

/**
 * Watches the nearest <form> in the subtree. When its server action
 * goes from pending -> settled, we call router.refresh() to pull
 * fresh server data without navigating away.
 *
 * Pass debounceMs to coalesce multiple quick submissions.
 */
export default function RefreshOnActionComplete({ debounceMs = 0 }: { debounceMs?: number } = {}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (debounceMs > 0) {
        timer.current = window.setTimeout(() => {
          router.refresh();
          timer.current = null;
        }, debounceMs);
      } else {
        router.refresh();
      }
    }
    wasPending.current = pending;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pending, router, debounceMs]);

  return null;
}
