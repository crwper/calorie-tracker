import { createBrowserClient, type SupabaseClient } from '@supabase/ssr';

// Singleton so multiple components share one client instance.
let _client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _client = createBrowserClient(url, anon, {
    auth: {
      persistSession: true,      // keep tokens in localStorage for Realtime
      autoRefreshToken: true,    // refresh access token automatically
    },
  });
  return _client;
}
