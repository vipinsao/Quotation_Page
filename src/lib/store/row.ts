import { resolveTotal } from "@/lib/compute";
import { normalizeQuotation } from "@/lib/normalize";
import type { Quotation, QuotationSummary } from "@/lib/types";
import type { StoredRow } from "./types";

/** Re-normalizing on read means older rows survive the schema growing. */
export function rowToQuotation(row: StoredRow): Quotation {
  const parsed = (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Quotation;
  const normalized = normalizeQuotation(parsed, parsed);
  return { ...normalized, id: row.id, slug: row.slug };
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function rowToSummary(row: StoredRow): QuotationSummary {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status as QuotationSummary["status"],
    clientName: row.client_name,
    eventTitle: row.event_title,
    total: Number(row.total),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** The denormalized columns the list view sorts and filters on. */
export function quotationToColumns(quotation: Quotation) {
  return {
    id: quotation.id,
    slug: quotation.slug,
    status: quotation.status,
    client_name: quotation.client.name,
    event_title: quotation.event.title,
    total: resolveTotal(quotation),
    data: JSON.stringify(quotation),
  };
}
