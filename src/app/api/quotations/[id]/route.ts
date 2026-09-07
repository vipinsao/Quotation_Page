import { NextResponse } from "next/server";
import { storageFailureResponse } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { deleteQuotation, getQuotationById, slugExists, updateQuotation } from "@/lib/db";
import { newToken } from "@/lib/id";
import { normalizeQuotation, sanitizeSlug } from "@/lib/normalize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const quotation = await getQuotationById(id);
    if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ quotation });
  } catch (error) {
    return storageFailureResponse(error);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  try {
    const existing = await getQuotationById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = normalizeQuotation(body, existing);

    // The share link is only rewritten when the admin deliberately changes it.
    let slug = existing.slug;
    if (typeof body.slug === "string" && body.slug.trim()) {
      const candidate = sanitizeSlug(body.slug, merged.client.name);
      slug = candidate;
      while (await slugExists(slug, id)) slug = `${candidate}-${newToken()}`;
    }

    const saved = await updateQuotation({ ...merged, id, slug });
    return NextResponse.json({ quotation: saved });
  } catch (error) {
    return storageFailureResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    if (!(await deleteQuotation(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return storageFailureResponse(error);
  }
}
