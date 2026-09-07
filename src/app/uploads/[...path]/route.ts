import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CONTENT_TYPES, isSafeUploadName, uploadDir } from "@/lib/uploads";

/** Serves uploaded photos to anyone with the quotation link — no session needed. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Only flat, generated filenames are ever valid — nothing nested, nothing relative.
  if (segments.length !== 1 || !isSafeUploadName(segments[0])) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = path.join(uploadDir(), segments[0]);
  try {
    const data = await fs.readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        // Filenames are UUIDs, so a stored file never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
