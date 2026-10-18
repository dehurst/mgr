import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({
  put: vi.fn(async () => ({})),
  get: vi.fn(),
  del: vi.fn(async () => {}),
  list: vi.fn(async () => ({ blobs: [{ pathname: "receipts/1-a.jpg" }, { pathname: "../evil" }], hasMore: false })),
}));
vi.mock("@vercel/blob", () => blob);

const { deleteUpload, isUploadPath, listUploads, readUpload, saveUpload, writeUpload } = await import("./uploads");
const { RECEIPT_TYPES } = await import("./uploads");

const file = (bytes: number, type = "image/jpeg") => new File([new Uint8Array(bytes)], "r.jpg", { type });

describe("upload paths", () => {
  it("accepts only <folder>/<file> names", () => {
    expect(isUploadPath("receipts/1791505790763-2049f6e9.png")).toBe(true);
    expect(isUploadPath("logo/1-ab.jpg")).toBe(true);
    for (const bad of ["../etc/passwd", "receipts/../../x", "/abs/x.jpg", "receipts/sub/x.jpg", "receipts/.hidden", "x.jpg", ""]) {
      expect(isUploadPath(bad)).toBe(false);
    }
  });
});

describe("local storage", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
    vi.stubEnv("UPLOADS_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_STORE_ID", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("saves, reads, lists, and deletes", async () => {
    const r = await saveUpload(file(10), "receipts", RECEIPT_TYPES);
    if (!r.ok) throw new Error(r.error);
    expect(r.relPath).toMatch(/^receipts\/\d+-[0-9a-f]{8}\.jpg$/);
    expect((await readUpload(r.relPath))?.data.length).toBe(10);
    expect(await listUploads()).toEqual([r.relPath]);
    await deleteUpload(r.relPath);
    expect(await readUpload(r.relPath)).toBeNull();
    expect(blob.put).not.toHaveBeenCalled();
  });

  it("rejects files over 4 MB and unknown types", async () => {
    expect(await saveUpload(file(4 * 1024 * 1024 + 1), "receipts", RECEIPT_TYPES)).toMatchObject({ ok: false });
    expect(await saveUpload(file(10, "text/html"), "receipts", RECEIPT_TYPES)).toMatchObject({ ok: false });
    expect(await readUpload("../../etc/passwd")).toBeNull();
  });
});

describe("Vercel Blob storage", () => {
  beforeEach(() => vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token"));
  afterEach(() => vi.unstubAllEnvs());

  it("always stores files as private blobs at their relative path", async () => {
    await writeUpload("receipts/1-a.jpg", new Uint8Array([1, 2]), "image/jpeg");
    expect(blob.put).toHaveBeenCalledWith("receipts/1-a.jpg", expect.anything(), expect.objectContaining({ access: "private", addRandomSuffix: false }));
    await expect(writeUpload("../evil.jpg", new Uint8Array([1]))).rejects.toThrow();
  });

  it("reads privately, skips unexpected names when listing, and deletes", async () => {
    blob.get.mockResolvedValueOnce({ statusCode: 200, stream: new Response("hi").body, blob: { contentType: "image/jpeg" } });
    const got = await readUpload("receipts/1-a.jpg");
    expect(blob.get).toHaveBeenCalledWith("receipts/1-a.jpg", expect.objectContaining({ access: "private" }));
    expect(new TextDecoder().decode(got!.data)).toBe("hi");
    blob.get.mockResolvedValueOnce(null);
    expect(await readUpload("receipts/missing.jpg")).toBeNull();
    expect(await listUploads()).toEqual(["receipts/1-a.jpg"]);
    await deleteUpload("receipts/1-a.jpg");
    expect(blob.del).toHaveBeenCalledWith("receipts/1-a.jpg");
  });
});
