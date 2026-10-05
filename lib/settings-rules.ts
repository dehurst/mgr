/**
 * The business's own tax ID for 1099s it issues: 9 digits, formatted as an EIN (12-3456789)
 * unless typed as an SSN (123-45-6789). Blank is allowed. Returns null when invalid.
 */
export function parseTaxId(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return "";
  if (/^\d{3}-\d{2}-\d{4}$/.test(s)) return s;
  const digits = s.replace(/[\s-]/g, "");
  if (!/^\d{9}$/.test(digits)) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}
