import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isServerless } from "@/lib/store";
import { uploadDir } from "@/lib/uploads";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — plenty for a web-sized JPEG.

export const UPLOAD_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export type UploadBackend = "blob" | "disk" | "unavailable";

/**
 * Vercel Blob when a token is present, the local disk otherwise. On a
 * serverless host without Blob there is nowhere durable to write, so uploads
 * are reported as unavailable rather than written somewhere that vanishes.
 */
export function uploadBackend(): UploadBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return isServerless() ? "unavailable" : "disk";
}

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

export async function saveUpload(file: File): Promise<SaveResult> {
  const extension = UPLOAD_EXTENSIONS[file.type];
  if (!extension) {
    return { ok: false, status: 415, error: "Please upload a JPG, PNG, WebP, AVIF or GIF image." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please keep it under 8 MB.`,
    };
  }

  // The name is generated, never taken from the upload — no path traversal.
  const name = `${randomUUID()}${extension}`;
  const backend = uploadBackend();

  if (backend === "unavailable") {
    return {
      ok: false,
      status: 501,
      error:
        "Photo uploads are not configured on this deployment. Add a Vercel Blob store " +
        "(BLOB_READ_WRITE_TOKEN), or paste an image URL instead.",
    };
  }

  if (backend === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`quotations/${name}`, file, {
      access: "public",
      contentType: file.type,
      // Names are already unique; a second random suffix would only make URLs uglier.
      addRandomSuffix: false,
    });
    return { ok: true, url: blob.url };
  }

  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/uploads/${name}` };
}
