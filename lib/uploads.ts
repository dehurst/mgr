import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export const RECEIPT_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "image/heic": ".heic",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".heic": "image/heic",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function uploadsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR ?? "./uploads");
}

/**
 * Save an uploaded file under uploads/<subdir>/ and return its path relative to the uploads dir
 * (that relative path is what gets stored in the database).
 */
export async function saveUpload(
  file: File,
  subdir: string,
  allowed: Record<string, string>,
): Promise<{ ok: true; relPath: string } | { ok: false; error: string }> {
  const ext = allowed[file.type];
  if (!ext) return { ok: false, error: `Unsupported file type (${file.type || "unknown"}).` };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "File is larger than 10 MB." };
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const relPath = path.posix.join(subdir, name);
  const abs = path.join(/*turbopackIgnore: true*/ uploadsDir(), relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { ok: true, relPath };
}

/** Resolve a stored relative path to an absolute one, refusing anything outside uploads/. */
export function resolveUpload(relPath: string): string | null {
  const root = uploadsDir();
  const abs = path.resolve(/*turbopackIgnore: true*/ root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export function mimeForPath(p: string): string {
  return MIME_BY_EXT[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

export async function deleteUpload(relPath: string | null | undefined): Promise<void> {
  if (!relPath) return;
  const abs = resolveUpload(relPath);
  if (abs) await fs.rm(abs, { force: true });
}
