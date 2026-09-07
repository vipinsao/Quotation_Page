import fs from "node:fs";
import path from "node:path";
import { quotationToColumns, rowToQuotation, rowToSummary } from "./row";
import type { QuotationStore, StoredRow } from "./types";
import type { Quotation } from "@/lib/types";

/**
 * Local development store.
 *
 * The import is dynamic so this native module is never *loaded* in a serverless
 * deployment, where DATABASE_URL is set and this function is never called. The
 * bundler still resolves it at build time, so it stays a real dependency.
 */
export async function createSqliteStore(dbPath: string): Promise<QuotationStore> {
  const { default: Database } = await import("better-sqlite3");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id          TEXT PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'draft',
      client_name TEXT NOT NULL DEFAULT '',
      event_title TEXT NOT NULL DEFAULT '',
      total       REAL NOT NULL DEFAULT 0,
      data        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quotations_updated ON quotations(updated_at DESC);
  `);

  return {
    kind: "sqlite",

    async list() {
      const rows = db.prepare("SELECT * FROM quotations ORDER BY updated_at DESC").all() as StoredRow[];
      return rows.map(rowToSummary);
    },

    async getById(id) {
      const row = db.prepare("SELECT * FROM quotations WHERE id = ?").get(id) as StoredRow | undefined;
      return row ? rowToQuotation(row) : null;
    },

    async getBySlug(slug) {
      const row = db.prepare("SELECT * FROM quotations WHERE slug = ?").get(slug) as StoredRow | undefined;
      return row ? rowToQuotation(row) : null;
    },

    async insert(quotation: Quotation) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO quotations (id, slug, status, client_name, event_title, total, data, created_at, updated_at)
         VALUES (@id, @slug, @status, @client_name, @event_title, @total, @data, @created_at, @updated_at)`,
      ).run({ ...quotationToColumns(quotation), created_at: now, updated_at: now });
      return quotation;
    },

    async update(quotation: Quotation) {
      const result = db
        .prepare(
          `UPDATE quotations
              SET slug = @slug, status = @status, client_name = @client_name,
                  event_title = @event_title, total = @total, data = @data, updated_at = @updated_at
            WHERE id = @id`,
        )
        .run({ ...quotationToColumns(quotation), updated_at: new Date().toISOString() });
      if (result.changes === 0) throw new Error(`Quotation ${quotation.id} not found`);
      return quotation;
    },

    async remove(id) {
      return db.prepare("DELETE FROM quotations WHERE id = ?").run(id).changes > 0;
    },

    async slugExists(slug, exceptId) {
      const row = db.prepare("SELECT id FROM quotations WHERE slug = ?").get(slug) as { id: string } | undefined;
      return Boolean(row && row.id !== exceptId);
    },
  };
}
