'use client';

import { useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function ClientAuthSync({
  serverUserId,
  accessToken,
  refreshToken,
}: {
  serverUserId: string | null;        // user id from server, or null if signed out
  accessToken?: string | null;        // from server session (if present)
  refreshToken?: string | null;       // from server session (if present)
}) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const sync = async () => {
      const supabase = getBrowserClient();
      const { data: client } = await supabase.auth.getUser();
      const clientUserId = client.user?.id ?? null;

      // Server says logged out → ensure browser is logged out too
      if (!serverUserId) {
        if (clientUserId) {
          await supabase.auth.signOut(); // clears localStorage tokens
        }
        return;
      }

      // Server says logged in → ensure browser has same user
      if (serverUserId && clientUserId === serverUserId) return; // already in sync

      // Need to hydrate: set browser session from server tokens
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    };

    void sync();
  }, [serverUserId, accessToken, refreshToken]);

  return null;
}
