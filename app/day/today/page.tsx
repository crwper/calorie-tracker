// app/day/today/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@/components/primitives/Alert';

function localTodayYMD(): string {
  const d = new Date(); // local device time (reflects travel automatically)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function TodayPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // No server-side guessing. We require the browser to have timezone support.
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }

    if (!tz || typeof tz !== 'string') {
      setErr('Could not determine your timezone in this browser.');
      return;
    }

    const ymd = localTodayYMD();
    router.replace(`/day/${ymd}`);
  }, [router]);

  if (err) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-3 font-sans bg-canvas">
        <h1 className="text-xl font-bold">Timezone required</h1>
        <Alert tone="error">
          {err} Please ensure JavaScript and Intl time zone support are available,
          then reload.
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-3 font-sans bg-canvas">
      <p className="text-sm text-muted-foreground">Determining today…</p>
    </main>
  );
}
