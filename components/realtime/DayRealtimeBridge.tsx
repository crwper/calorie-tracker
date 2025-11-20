// components/realtime/DayRealtimeBridge.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { shouldIgnoreRealtime } from '@/components/realtime/localWritePulse';

export default function DayRealtimeBridge({
  dayId,
  selectedYMD,
}: {
  dayId: string | null;
  selectedYMD: string;
}) {
  const router = useRouter();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    // We keep separate channels so we can start `entries` later when the day row appears.
    let entriesChannel: ReturnType<typeof supabase.channel> | null = null;
    let daysChannel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefresh = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (mounted) {
          console.log('[REFRESH] realtime (debounced 250ms)');
          router.refresh();
        }
        debounceRef.current = null;
      }, 250); // same debounce you used in Step 5
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
        .subscribe(); // status callback optional
    };

    const run = async () => {
      // Ensure the browser has a user JWT before subscribing
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;

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
            // A day row for this date was just created somewhere else (or here in another tab).
            const newDayId = (payload as any)?.new?.id as string | undefined;
            if (!newDayId) return;
            startEntriesSubscription(newDayId);
            scheduleRefresh(); // pull the just-created day+entries
          }
        )
        .subscribe();
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
    };
  }, [dayId, selectedYMD, router]);

  return null;
}
