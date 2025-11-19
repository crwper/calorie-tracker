// components/realtime/DayRealtimeBridge.tsx
'use client';
import { useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function DayRealtimeBridge({
  dayId,
  selectedYMD, // reserved for Step 6
}: {
  dayId: string | null;
  selectedYMD: string;
}) {
  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;

      const log = (label: string) => (payload: any) => {
        const n = payload.new ?? null;
        const o = payload.old ?? null;
        console.debug(`[RT][entries:${label}] id=${n?.id ?? o?.id}`, payload);
      };

      if (!dayId) {
        console.debug('[RT] No dayId for this date yet; Step 6 will handle bootstrap.');
        return;
      }

      channel = supabase
        .channel(`rt-entries-day-${dayId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries', filter: `day_id=eq.${dayId}` }, log('INSERT'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entries', filter: `day_id=eq.${dayId}` }, log('UPDATE'))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'entries', filter: `day_id=eq.${dayId}` }, log('DELETE'))
        .subscribe(s => console.debug('[RT] channel status →', s));
    };

    void run();
    return () => {
      mounted = false;
      if (channel) getBrowserClient().removeChannel(channel);
    };
  }, [dayId, selectedYMD]);

  return null;
}
