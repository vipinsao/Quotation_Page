import type { Quotation, QuotationSummary } from "@/lib/types";

/**
 * Everything the app needs from persistence. SQLite backs local development;
 * Postgres backs any serverless deployment, where there is no writable disk.
 */
export type QuotationStore = {
  readonly kind: "sqlite" | "postgres";
  list(): Promise<QuotationSummary[]>;
  getById(id: string): Promise<Quotation | null>;
  getBySlug(slug: string): Promise<Quotation | null>;
  insert(quotation: Quotation): Promise<Quotation>;
  update(quotation: Quotation): Promise<Quotation>;
  remove(id: string): Promise<boolean>;
  slugExists(slug: string, exceptId?: string): Promise<boolean>;
};

/** The persisted row, before it is turned back into a Quotation. */
export type StoredRow = {
  id: string;
  slug: string;
  status: string;
  client_name: string;
  event_title: string;
  total: number;
  data: string | Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
};
