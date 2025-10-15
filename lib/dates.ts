export function todayYMDVancouver(): string {
  const tz = 'America/Vancouver';
  const now = new Date();
  // Get components in local (Vancouver) time
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(now);
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}
