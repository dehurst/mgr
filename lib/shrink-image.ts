// Browser-only: make phone photos small enough to upload (and to store) before they're sent.
// Receipts only need to be legible, so large photos become a ~2000px JPEG (usually well under
// 1 MB). Formats the browser can't draw (e.g. HEIC outside Safari) and PDFs pass through as-is.

const MAX_SIDE = 2000;
const SHRINK_OVER_BYTES = 1.5 * 1024 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_OVER_BYTES) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
}
