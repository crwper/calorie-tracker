// components/realtime/DayRealtimeBridge.tsx
'use client';

import { useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function DayRealtimeBridge() {
  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      // If the browser is not authenticated yet, don't subscribe.
      if (!mounted || !user) {
        console.warn('[RT] No browser user yet; skipping subscription');
        return;
      }

      console.debug('[RT] Browser user id:', user.id);

      const log = (label: string) => (payload: any) => {
        const newRow = payload.new ?? null;
        const oldRow = payload.old ?? null;
        const id = (newRow?.id ?? oldRow?.id) as string | undefined;
        const dayId = (newRow?.day_id ?? oldRow?.day_id) as string | undefined;
        console.debug(`[RT][entries:${label}] id=${id} day=${dayId}`, payload);
      };

      channel = supabase
        .channel('rt-entries-broad')
        // Use explicit event filters (INSERT/UPDATE/DELETE) instead of '*'
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries' }, log('INSERT'))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entries' }, log('UPDATE'))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'entries' }, log('DELETE'));

      channel.subscribe((status) => {
        console.debug('[RT] channel status →', status);
      });
    };

    void setup();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
