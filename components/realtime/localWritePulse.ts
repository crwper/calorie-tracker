// components/realtime/localWritePulse.ts
'use client';

/** Duration (ms) after a local write to ignore the Realtime echo in THIS tab. */
const DEFAULT_TTL = 400;

let lastWriteAt = 0;

/** Mark that THIS tab just completed a server action and is about to refresh locally. */
export function markLocalWrite(): void {
  lastWriteAt = Date.now();
}

/** True if a Realtime event happens within the ignore window after a local write. */
export function shouldIgnoreRealtime(ttlMs: number = DEFAULT_TTL): boolean {
  return Date.now() - lastWriteAt <= ttlMs;
}
