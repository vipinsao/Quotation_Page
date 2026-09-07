import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { blankQuotation } from "@/lib/defaults";
import { insertQuotation, listQuotations, slugExists } from "@/lib/db";
import { buildSlug } from "@/lib/id";
import { normalizeQuotation } from "@/lib/normalize";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ quotations: await listQuotations() });
}

/**
 * Creates a quotation. Pass `duplicateOf` payload to start from an existing
 * one — the studio sends near-identical quotes all season.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    clientName?: string;
    source?: unknown;
  };

  const clientName = (body.clientName ?? "").trim() || "New Client";
  const fresh = blankQuotation({ clientName });

  // When duplicating, keep the source content but take a new id/slug/status.
  const quotation = body.source
    ? { ...normalizeQuotation(body.source, fresh), id: fresh.id, slug: fresh.slug, status: "draft" as const }
    : fresh;

  let slug = quotation.slug;
  while (await slugExists(slug)) slug = buildSlug(quotation.client.name);

  const saved = await insertQuotation({ ...quotation, slug });
  return NextResponse.json({ quotation: saved }, { status: 201 });
}
