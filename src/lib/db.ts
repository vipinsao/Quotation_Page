import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { normalizeQuotation } from "./normalize";
import { resolveTotal } from "./compute";
import type { Quotation, QuotationSummary } from "./types";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "quotations.db");

let instance: Database.Database | null = null;

function db(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.exec(`
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

  instance = conn;
  return conn;
}

type Row = {
  id: string;
  slug: string;
  status: string;
  client_name: string;
  event_title: string;
  total: number;
  data: string;
  created_at: string;
  updated_at: string;
};

/** The stored JSON is re-normalized on read so older rows survive schema growth. */
function rowToQuotation(row: Row): Quotation {
  const parsed = JSON.parse(row.data) as Quotation;
  const normalized = normalizeQuotation(parsed, parsed);
  return { ...normalized, id: row.id, slug: row.slug, status: normalized.status };
}

export function listQuotations(): QuotationSummary[] {
  const rows = db()
    .prepare("SELECT * FROM quotations ORDER BY updated_at DESC")
    .all() as Row[];

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status as QuotationSummary["status"],
    clientName: r.client_name,
    eventTitle: r.event_title,
    total: r.total,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getQuotationById(id: string): Quotation | null {
  const row = db().prepare("SELECT * FROM quotations WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToQuotation(row) : null;
}

export function getQuotationBySlug(slug: string): Quotation | null {
  const row = db().prepare("SELECT * FROM quotations WHERE slug = ?").get(slug) as Row | undefined;
  return row ? rowToQuotation(row) : null;
}

export function insertQuotation(quotation: Quotation): Quotation {
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO quotations (id, slug, status, client_name, event_title, total, data, created_at, updated_at)
       VALUES (@id, @slug, @status, @client_name, @event_title, @total, @data, @created_at, @updated_at)`,
    )
    .run({
      id: quotation.id,
      slug: quotation.slug,
      status: quotation.status,
      client_name: quotation.client.name,
      event_title: quotation.event.title,
      total: resolveTotal(quotation),
      data: JSON.stringify(quotation),
      created_at: now,
      updated_at: now,
    });
  return quotation;
}

export function updateQuotation(quotation: Quotation): Quotation {
  const now = new Date().toISOString();
  const result = db()
    .prepare(
      `UPDATE quotations
          SET slug = @slug, status = @status, client_name = @client_name,
              event_title = @event_title, total = @total, data = @data, updated_at = @updated_at
        WHERE id = @id`,
    )
    .run({
      id: quotation.id,
      slug: quotation.slug,
      status: quotation.status,
      client_name: quotation.client.name,
      event_title: quotation.event.title,
      total: resolveTotal(quotation),
      data: JSON.stringify(quotation),
      updated_at: now,
    });

  if (result.changes === 0) throw new Error(`Quotation ${quotation.id} not found`);
  return quotation;
}

export function deleteQuotation(id: string): boolean {
  return db().prepare("DELETE FROM quotations WHERE id = ?").run(id).changes > 0;
}

export function slugExists(slug: string, exceptId?: string): boolean {
  const row = db()
    .prepare("SELECT id FROM quotations WHERE slug = ?")
    .get(slug) as { id: string } | undefined;
  return Boolean(row && row.id !== exceptId);
}
