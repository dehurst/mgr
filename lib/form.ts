// Small helpers for reading FormData in server actions.

export type FieldErrors = Record<string, string>;
export type ActionState = { ok?: boolean; message?: string; errors?: FieldErrors };

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}

/** Parse a non-negative integer field; returns null if empty or invalid. */
export function int(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
