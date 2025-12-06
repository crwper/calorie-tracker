// app/error.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Alert from '@/components/primitives/Alert';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In dev you’ll see it in the console; later you can wire this to Sentry/etc.
    console.error('[app/error.tsx]', error);
  }, [error]);

  const isProd = process.env.NODE_ENV === 'production';

  // For testers, you may prefer showing the real message. If you want to avoid
  // raw DB strings in prod, swap to a generic message here.
  const message = isProd
    ? 'Something went wrong. Please try again.'
    : error.message || 'Unknown error';

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4 font-sans bg-canvas">
      <h1 className="text-2xl font-bold">Something went wrong</h1>

      <Alert tone="error">
        <div className="space-y-2">
          <div>{message}</div>
          {!isProd && error.digest ? (
            <div className="text-[11px] text-subtle-foreground">
              Digest: <span className="font-mono">{error.digest}</span>
            </div>
          ) : null}
        </div>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
        >
          Try again
        </button>

        <Link
          href="/"
          className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
        >
          Go home
        </Link>

        <Link
          href="/login"
          className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
