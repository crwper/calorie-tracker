// lib/supabase/expect.ts
type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

export function expectNoError<T>(
  result: SupabaseResult<T>,
  context: string
): T {
  const { data, error } = result;

  if (error) {
    console.error('[Supabase]', context, error);
    throw new Error(`Database error while ${context}`);
  }

  if (data == null) {
    // For plain .select() calls you probably don't expect null here.
    console.error('[Supabase]', context, 'No data returned');
    throw new Error(`No data returned while ${context}`);
  }

  return data;
}
