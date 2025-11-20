// components/realtime/DayRealtimeBridge.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { shouldIgnoreRealtime } from '@/components/realtime/localWritePulse';

type RtStatus = 'idle' | 'connecting' | 'subscribed' | 'error' | 'closed';

export default function DayRealtimeBridge({
  dayId,
  selectedYMD,
}: {
  dayId: string | null;
  selectedYMD: string;
}) {
  const router = useRouter();
  const debounceRef = useRef<number | null>(null);

  // Realtime connection status for this page’s subscriptions
  const [status, setStatus] = useState<RtStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    // Whenever the scope changes (dayId/selectedYMD), treat it as a new connection attempt
    setStatus('connecting');
    setLastError(null);

    // Separate channels so we can start entries later when the day row appears.
    let entriesChannel: ReturnType<typeof supabase.channel> | null = null;
    let daysChannel: ReturnType<typeof supabase.channel> | null = null;

    const handleStatus =
      (source: 'entries' | 'days') =>
      (s: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT', err?: { message?: string }) => {
        if (!mounted) return;
        // eslint-disable-next-line no-console
        console.log('[RT] channel status', { source, status: s, err });

        if (s === 'SUBSCRIBED') {
          setStatus('subscribed');
          return;
        }

        if (s === 'CLOSED') {
          // Closed without an explicit error (eg. route change / cleanup)
          setStatus((prev) => (prev === 'error' ? prev : 'closed'));
          return;
        }

        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setStatus('error');
          if (err?.message) setLastError(err.message);
        }
      };

    const scheduleRefresh = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (mounted) {
          // eslint-disable-next-line no-console
          console.log('[REFRESH] realtime (debounced 250ms)');
          router.refresh();
        }
        debounceRef.current = null;
      }, 250);
    };

    // One place to gate Realtime-driven refreshes for entries
    const onEntriesEvent = (payload?: unknown) => {
      const ignore = shouldIgnoreRealtime(400);
      // eslint-disable-next-line no-console
      console.log('[RT]', new Date().toISOString(), 'entries event', { ignore, payload });
      if (!ignore) scheduleRefresh();
    };

    const startEntriesSubscription = (id: string) => {
      // Tear down any existing entries sub before starting a new one
      if (entriesChannel) supabase.removeChannel(entriesChannel);

      entriesChannel = supabase
        .channel(`rt-entries-day-${id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'entries', filter: `day_id=eq.${id}` },
          onEntriesEvent
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'entries', filter: `day_id=eq.${id}` },
          onEntriesEvent
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'entries', filter: `day_id=eq.${id}` },
          onEntriesEvent
        )
        .subscribe(handleStatus('entries'));
    };

    const run = async () => {
      // Ensure the browser has a user JWT before subscribing
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) {
        setStatus('error');
        setLastError('No authenticated user for realtime');
        return;
      }

      if (dayId) {
        // Normal case (Step 4/5): day exists → listen to entries for that day
        startEntriesSubscription(dayId);
        return;
      }

      // Bootstrap case: day doesn't exist (for this user+date)
      // RLS ensures we only see our own rows; filter by date to keep scope tight.
      daysChannel = supabase
        .channel(`rt-days-bootstrap-${selectedYMD}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'days', filter: `date=eq.${selectedYMD}` },
          (payload) => {
            const newDayId = (payload as any)?.new?.id as string | undefined;
            if (!newDayId) return;

            // As soon as the row appears, move to the scoped entries subscription
            startEntriesSubscription(newDayId);
            scheduleRefresh();

            // We don’t need the bootstrap channel anymore; clean it up eagerly
            if (daysChannel) {
              supabase.removeChannel(daysChannel);
              daysChannel = null;
            }
          }
        )
        .subscribe(handleStatus('days'));
    };

    void run();

    return () => {
      mounted = false;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (entriesChannel) supabase.removeChannel(entriesChannel);
      if (daysChannel) supabase.removeChannel(daysChannel);
      setStatus('closed');
    };
  }, [dayId, selectedYMD, router]);

  // Tiny dev-only status pill (Step 8 “UI cue”)
  const showIndicator = process.env.NODE_ENV !== 'production';

  if (!showIndicator) {
    return null;
  }

  let dotClass = 'bg-zinc-400';
  if (status === 'connecting') dotClass = 'bg-amber-400';
  if (status === 'subscribed') dotClass = 'bg-emerald-500';
  if (status === 'error') dotClass = 'bg-red-500';

  const label = status === 'idle' ? 'idle' : status;

  return (
    <div className="fixed bottom-2 right-2 z-40 text-[11px]">
      <div
        className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 shadow"
        title={
          lastError
            ? `Realtime: ${label} – ${lastError}`
            : `Realtime: ${label}`
        }
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
        <span className="text-subtle-foreground">RT&nbsp;{label}</span>
      </div>
    </div>
  );
}
