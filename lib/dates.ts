export function todayYMDVancouver(): string {
  const tz = 'America/Vancouver';
  const now = new Date();
  // Get components in local (Vancouver) time
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(now);
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

// Render a YYYY-MM-DD as “Saturday, October 18, 2025” in the given TZ
export function formatYMDLongInTZ(ymd: string, tz = 'America/Vancouver'): string {
  const [y, m, d] = ymd.split('-').map(Number);
  // Use a UTC noon to avoid DST edge cases when formatting in another TZ
  const dt = new Date(Date.UTC(y, (m - 1), d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dt);
}
