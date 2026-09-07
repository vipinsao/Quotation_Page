import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getPostgresClient, isServerless, storeKind } from "@/lib/store";
import { saveFile } from "./postgres-files";
import { uploadDir } from "@/lib/uploads";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — plenty for a web-sized JPEG.

/**
 * Serverless functions cap their response body at around 4.5 MB, and a
 * database-stored photograph is served through one. Anything larger would
 * upload fine and then fail to display, so it is refused up front.
 */
export const MAX_DB_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export const UPLOAD_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export type UploadBackend = "blob" | "postgres" | "disk" | "unavailable";

/** Every Vercel Blob read-write token starts with this, whatever it is named. */
const BLOB_TOKEN_PATTERN = /^vercel_blob_rw_/i;

const PREFERRED_BLOB_ENV_VAR = "BLOB_READ_WRITE_TOKEN";

/**
 * Connecting a Blob store lets you choose the environment-variable prefix, so
 * the token can arrive as STORAGE_BLOB_READ_WRITE_TOKEN just as easily as the
 * documented name. The token's own format is unmistakable, so it is found by
 * value rather than by what someone decided to call it.
 */
export function blobTokenSource(): string | null {
  if (BLOB_TOKEN_PATTERN.test(process.env[PREFERRED_BLOB_ENV_VAR]?.trim() ?? "")) {
    return PREFERRED_BLOB_ENV_VAR;
  }
  return blobTokenCandidates()[0] ?? null;
}

/** Names of every variable holding a Blob token, for diagnostics. Never values. */
export function blobTokenCandidates(): string[] {
  return Object.keys(process.env)
    .filter((key) => BLOB_TOKEN_PATTERN.test(process.env[key]?.trim() ?? ""))
    .sort();
}

export function blobToken(): string | null {
  const key = blobTokenSource();
  const value = key ? process.env[key]?.trim() : null;
  return value || null;
}

/**
 * Vercel Blob when a token is present, the local disk otherwise. On a
 * serverless host without Blob there is nowhere durable to write, so uploads
 * are reported as unavailable rather than written somewhere that vanishes.
 */
export function uploadBackend(): UploadBackend {
  if (blobToken()) return "blob";
  if (!isServerless()) return "disk";
  // No object storage, but a database is configured — good enough for a
  // handful of web-sized photographs, and it means the upload button works
  // without the studio having to wire up a second service.
  if (storeKind() === "postgres") return "postgres";
  return "unavailable";
}

export function uploadLimitBytes(): number {
  return uploadBackend() === "postgres" ? MAX_DB_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
}

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

export async function saveUpload(file: File): Promise<SaveResult> {
  const extension = UPLOAD_EXTENSIONS[file.type];
  if (!extension) {
    return { ok: false, status: 415, error: "Please upload a JPG, PNG, WebP, AVIF or GIF image." };
  }

  const backend = uploadBackend();
  const limit = uploadLimitBytes();

  if (file.size > limit) {
    return {
      ok: false,
      status: 413,
      error:
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please keep it under ` +
        `${(limit / 1024 / 1024).toFixed(1)} MB` +
        (backend === "postgres" ? " — or connect a Vercel Blob store to raise the limit to 8 MB." : "."),
    };
  }

  // The name is generated, never taken from the upload — no path traversal.
  const name = `${randomUUID()}${extension}`;

  if (backend === "unavailable") {
    return {
      ok: false,
      status: 501,
      error:
        "Photo uploads are not configured on this deployment. Connect a database or a " +
        "Vercel Blob store, or paste an image URL instead.",
    };
  }

  if (backend === "postgres") {
    const client = await getPostgresClient();
    if (!client) {
      return { ok: false, status: 503, error: "The database is not reachable right now." };
    }
    try {
      await saveFile(client, name, file.type, Buffer.from(await file.arrayBuffer()));
      return { ok: true, url: `/uploads/${name}` };
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: `Could not store the photo: ${error instanceof Error ? error.message : "unknown error"}`,
      };
    }
  }

  if (backend === "blob") {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`quotations/${name}`, file, {
        access: "public",
        contentType: file.type,
        // The token is passed explicitly: it is not always under the name the
        // SDK looks for by default.
        token: blobToken() ?? undefined,
        // Names are already unique; a second random suffix would only make URLs uglier.
        addRandomSuffix: false,
      });
      return { ok: true, url: blob.url };
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: `The photo store rejected the upload: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      };
    }
  }

  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/uploads/${name}` };
}
