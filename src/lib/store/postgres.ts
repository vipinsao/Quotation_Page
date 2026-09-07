import { quotationToColumns, rowToQuotation, rowToSummary } from "./row";
import type { QuotationStore, StoredRow } from "./types";
import type { Quotation } from "@/lib/types";

/**
 * The minimum this store needs from a driver. Production passes a `pg` Pool;
 * the tests pass an in-process Postgres, so the SQL below is exercised for real.
 */
export type PostgresClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

// Kept as separate statements: not every driver accepts a multi-statement query.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS quotations (
     id          TEXT PRIMARY KEY,
     slug        TEXT NOT NULL UNIQUE,
     status      TEXT NOT NULL DEFAULT 'draft',
     client_name TEXT NOT NULL DEFAULT '',
     event_title TEXT NOT NULL DEFAULT '',
     total       DOUBLE PRECISION NOT NULL DEFAULT 0,
     data        JSONB NOT NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_quotations_updated ON quotations(updated_at DESC)`,
];

export async function createPostgresStore(client: PostgresClient): Promise<QuotationStore> {
  for (const statement of SCHEMA) await client.query(statement);

  const one = async (text: string, params: unknown[]) => {
    const { rows } = await client.query(text, params);
    return (rows[0] as StoredRow | undefined) ?? null;
  };

  return {
    kind: "postgres",

    async list() {
      const { rows } = await client.query("SELECT * FROM quotations ORDER BY updated_at DESC");
      return (rows as StoredRow[]).map(rowToSummary);
    },

    async getById(id) {
      const row = await one("SELECT * FROM quotations WHERE id = $1", [id]);
      return row ? rowToQuotation(row) : null;
    },

    async getBySlug(slug) {
      const row = await one("SELECT * FROM quotations WHERE slug = $1", [slug]);
      return row ? rowToQuotation(row) : null;
    },

    async insert(quotation: Quotation) {
      const c = quotationToColumns(quotation);
      await client.query(
        `INSERT INTO quotations (id, slug, status, client_name, event_title, total, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [c.id, c.slug, c.status, c.client_name, c.event_title, c.total, c.data],
      );
      return quotation;
    },

    async update(quotation: Quotation) {
      const c = quotationToColumns(quotation);
      const { rows } = await client.query(
        `UPDATE quotations
            SET slug = $2, status = $3, client_name = $4, event_title = $5,
                total = $6, data = $7::jsonb, updated_at = now()
          WHERE id = $1
        RETURNING id`,
        [c.id, c.slug, c.status, c.client_name, c.event_title, c.total, c.data],
      );
      if (rows.length === 0) throw new Error(`Quotation ${quotation.id} not found`);
      return quotation;
    },

    async remove(id) {
      const { rows } = await client.query("DELETE FROM quotations WHERE id = $1 RETURNING id", [id]);
      return rows.length > 0;
    },

    async slugExists(slug, exceptId) {
      const row = await one("SELECT id FROM quotations WHERE slug = $1", [slug]);
      return Boolean(row && row.id !== exceptId);
    },
  };
}
