'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export default function WhoAmI() {
  const [who, setWho] = useState<string>('…');

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    const update = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data.user;
      setWho(u ? `${u.email ?? u.id}` : 'no client session');
      console.log('[WhoAmI] client user:', u);
    };

    // Initial read
    void update();

    // React to future changes (login/logout, setSession/signOut)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void update();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <span className="text-xs text-subtle-foreground" title="Client-side auth state">
      {who}
    </span>
  );
}
