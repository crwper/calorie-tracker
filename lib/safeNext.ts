// lib/safeNext.ts
export function safeNextPath(raw: unknown): string | null {
  // Next.js searchParams can be string | string[] | undefined
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== 'string') return null;
  const s = first.trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return null;
  if (/[\r\n]/.test(s)) return null;
  return s;
}
