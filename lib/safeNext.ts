// lib/safeNext.ts
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return null;
  if (/[\r\n]/.test(s)) return null;
  return s;
}
