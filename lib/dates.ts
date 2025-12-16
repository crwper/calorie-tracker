// For previous work that wanted a display TZ
export function formatYMDLongInTZ(ymd: string, tz: string): string {
  if (!tz) throw new Error('Timezone is required');
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(dt);
}

// Default “today” for a given IANA timezone → YYYY-MM-DD (literal date)
export function todayInTZYMD(tz: string): string {
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(now);
  return `${y}-${m}-${d}`;
}

// Validate YYYY-MM-DD string
export function isValidYMD(ymd?: string): boolean {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// Add days to a YYYY-MM-DD (pure date math via UTC-noon to avoid DST edge cases)
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Format YYYY-MM-DD as “Saturday, October 18, 2025” (timezone-invariant)
// Ensure "Month Day" stays together on narrow screens (e.g., "October 18").
export function formatYMDLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).formatToParts(dt);

  // Rebuild string, but glue month + day with NBSP.
  // Typical order: weekday, literal(", "), month, literal(" "), day, literal(", "), year
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    if (p.type === 'month') {
      const next = parts[i + 1];
      const next2 = parts[i + 2];

      if (next?.type === 'literal' && next.value === ' ' && next2?.type === 'day') {
        out += p.value + '\u00A0' + next2.value; // NBSP
        i += 2; // skip the space + day we just consumed
        continue;
      }
    }

    out += p.value;
  }

  return out;
}
