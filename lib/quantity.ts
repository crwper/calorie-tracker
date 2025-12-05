// lib/quantity.ts

/**
 * Parse a user-typed numeric string into a JS number.
 * Supports:
 * - "1" / "0.75"
 * - "3/4"
 * - "1 1/2" (mixed number)
 *
 * Returns null for empty/invalid/non-finite.
 */
export function parseNumberish(raw: unknown): number | null {
  if (raw == null) return null;

  // FormData file uploads etc.
  if (typeof File !== 'undefined' && raw instanceof File) return null;

  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Mixed number: "-1 1/2", "1 1/2"
  let m = /^([+-]?\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const whole = Number(m[1]);
    const num = Number(m[2]);
    const den = Number(m[3]);
    if (
      !Number.isFinite(whole) ||
      !Number.isFinite(num) ||
      !Number.isFinite(den) ||
      den === 0
    ) {
      return null;
    }
    const frac = num / den;
    const n = whole < 0 ? whole - frac : whole + frac;
    return Number.isFinite(n) ? n : null;
  }

  // Simple fraction: "-3/4", "3/4"
  m = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    const n = num / den;
    return Number.isFinite(n) ? n : null;
  }

  // Decimal / integer
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Convenience: parseNumberish + require > 0 (allows fractions). */
export function parsePositiveNumber(raw: unknown): number | null {
  const v = parseNumberish(raw);
  if (v == null) return null;
  return v > 0 ? v : null;
}

/**
 * Parse a user-typed decimal numeric string into a positive JS number.
 * Accepts plain integers/decimals like "1" or "0.75".
 * Returns null for empty/invalid/non-finite or non-positive.
 * Does NOT accept fraction formats like "1 1/2" or "3/4".
 */
export function parsePositiveDecimal(raw: unknown): number | null {
  if (raw == null) return null;

  // FormData file uploads etc.
  if (typeof File !== 'undefined' && raw instanceof File) return null;

  const s = String(raw).trim();
  if (!s) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
