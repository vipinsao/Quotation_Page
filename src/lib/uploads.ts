import path from "node:path";

/**
 * Uploads live outside `public/` on purpose: Next only serves the `public`
 * directory as it existed at build time, so anything written afterwards would
 * 404 in production. They are streamed back by /uploads/[...path] instead,
 * which also means a deployment can point UPLOAD_DIR at a persistent disk.
 */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

export const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/** Accepts only the generated `<uuid>.<ext>` names this app writes. */
export function isSafeUploadName(name: string): boolean {
  return /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|avif|gif)$/i.test(name);
}
