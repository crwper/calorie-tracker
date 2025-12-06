// components/auth/ClientAuthSync.tsx
'use client';

import { useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function ClientAuthSync({
  serverUserId,
  accessToken,
  refreshToken,
}: {
  serverUserId: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;

    const sync = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      const clientUserId = data.user?.id ?? null;

      // Server says logged out → ensure browser is logged out too
      if (!serverUserId) {
        if (clientUserId) await supabase.auth.signOut();
        return;
      }

      // Server says logged in → ensure browser has same user
      if (clientUserId === serverUserId) return;

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [serverUserId, accessToken, refreshToken]);

  return null;
}
