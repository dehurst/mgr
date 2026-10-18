import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { MAX_UPLOAD_BYTES } from "./upload-limits";

// Receipts and the logo. Stored in UPLOADS_DIR on the Mac, or in a private Vercel Blob store when
// one is connected (BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID). Either way the database keeps only
// the relative path ("receipts/<name>.jpg"), and files are served through app routes, never by a
// public URL.

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

export function usesBlobStorage(): boolean {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function uploadsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR ?? "./uploads");
}

/** Stored paths are always "<folder>/<file>" made by saveUpload; anything else is refused. */
export function isUploadPath(relPath: string): boolean {
  return /^[a-z]+\/[A-Za-z0-9][\w.-]*$/.test(relPath) && !relPath.includes("..");
}

/** Resolve a stored relative path to an absolute local one, refusing anything outside uploads/. */
export function resolveUpload(relPath: string): string | null {
  const root = uploadsDir();
  const abs = path.resolve(/*turbopackIgnore: true*/ root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

export function mimeForPath(p: string): string {
  return MIME_BY_EXT[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

/** Save an uploaded file under <subdir>/ and return its relative path (what the database stores). */
export async function saveUpload(
  file: File,
  subdir: string,
  allowed: Record<string, string>,
): Promise<{ ok: true; relPath: string } | { ok: false; error: string }> {
  const ext = allowed[file.type];
  if (!ext) return { ok: false, error: `Unsupported file type (${file.type || "unknown"}).` };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const relPath = path.posix.join(subdir, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  await writeUpload(relPath, new Uint8Array(await file.arrayBuffer()), file.type);
  return { ok: true, relPath };
}

/** Write bytes at a relative path (used by saveUpload and the one-time move to the cloud). */
export async function writeUpload(relPath: string, data: Uint8Array, contentType = mimeForPath(relPath)): Promise<void> {
  if (!isUploadPath(relPath)) throw new Error(`Bad upload path: ${relPath}`);
  if (usesBlobStorage()) {
    await put(relPath, Buffer.from(data), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  const abs = resolveUpload(relPath)!;
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(abs), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ abs, data);
}

/** The file's bytes and type, or null if it doesn't exist. */
export async function readUpload(relPath: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  if (!isUploadPath(relPath)) return null;
  if (usesBlobStorage()) {
    const r = await get(relPath, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { data: new Uint8Array(await new Response(r.stream).arrayBuffer()), contentType: r.blob.contentType || mimeForPath(relPath) };
  }
  const abs = resolveUpload(relPath);
  if (!abs) return null;
  try {
    return { data: new Uint8Array(await fs.readFile(/*turbopackIgnore: true*/ abs)), contentType: mimeForPath(abs) };
  } catch {
    return null;
  }
}

export async function deleteUpload(relPath: string | null | undefined): Promise<void> {
  if (!relPath || !isUploadPath(relPath)) return;
  if (usesBlobStorage()) {
    await del(relPath);
    return;
  }
  const abs = resolveUpload(relPath);
  if (abs) await fs.rm(/*turbopackIgnore: true*/ abs, { force: true });
}

/** Every stored file's relative path (for backups). */
export async function listUploads(): Promise<string[]> {
  if (usesBlobStorage()) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => b.pathname).filter((p) => isUploadPath(p)));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  const root = uploadsDir();
  const out: string[] = [];
  for (const dir of await fs.readdir(/*turbopackIgnore: true*/ root, { withFileTypes: true }).catch(() => [])) {
    if (!dir.isDirectory()) continue;
    for (const f of await fs.readdir(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ root, dir.name), { withFileTypes: true })) {
      const rel = `${dir.name}/${f.name}`;
      if (f.isFile() && isUploadPath(rel)) out.push(rel);
    }
  }
  return out.sort();
}
