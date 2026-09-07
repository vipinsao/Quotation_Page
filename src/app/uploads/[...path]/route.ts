import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPostgresClient } from "@/lib/store";
import { readFile } from "@/lib/storage/postgres-files";
import { uploadBackend } from "@/lib/storage";
import { CONTENT_TYPES, isSafeUploadName, uploadDir } from "@/lib/uploads";

/** Serves uploaded photos to anyone with the quotation link — no session needed. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Only flat, generated filenames are ever valid — nothing nested, nothing relative.
  if (segments.length !== 1 || !isSafeUploadName(segments[0])) {
    return new NextResponse("Not found", { status: 404 });
  }

  const name = segments[0];
  // Filenames are UUIDs, so a stored file never changes.
  const headers = { "Cache-Control": "public, max-age=31536000, immutable" };

  if (uploadBackend() === "postgres") {
    const client = await getPostgresClient();
    if (!client) return new NextResponse("Not found", { status: 404 });
    const stored = await readFile(client, name).catch(() => null);
    if (!stored) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(stored.bytes), {
      headers: { ...headers, "Content-Type": stored.contentType },
    });
  }

  try {
    const data = await fs.readFile(path.join(uploadDir(), name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        ...headers,
        "Content-Type": CONTENT_TYPES[path.extname(name).toLowerCase()] || "application/octet-stream",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
