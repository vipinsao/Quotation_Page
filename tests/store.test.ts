import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blankQuotation } from "@/lib/defaults";
import { createPostgresStore } from "@/lib/store/postgres";
import { createSqliteStore } from "@/lib/store/sqlite";
import type { QuotationStore } from "@/lib/store/types";

/**
 * Both stores have to behave identically — the app is developed on SQLite and
 * deployed on Postgres, so any difference between them is a production-only
 * bug. PGlite runs a real Postgres in-process, so the SQL is genuinely tested.
 */
const backends: { name: string; create: () => Promise<{ store: QuotationStore; cleanup: () => void }> }[] = [
  {
    name: "sqlite",
    create: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wq-store-"));
      const store = await createSqliteStore(path.join(dir, "test.db"));
      return { store, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
    },
  },
  {
    name: "postgres",
    create: async () => {
      const pg = new PGlite();
      const store = await createPostgresStore({
        query: async (text, params) => {
          const result = await pg.query(text, params as unknown[]);
          return { rows: result.rows as unknown[] };
        },
      });
      return { store, cleanup: () => void pg.close() };
    },
  },
];

for (const backend of backends) {
  describe(`${backend.name} store`, () => {
    let store: QuotationStore;
    let cleanup: () => void;

    beforeAll(async () => {
      const built = await backend.create();
      store = built.store;
      cleanup = built.cleanup;
    });

    afterAll(() => cleanup());

    it("reports which backend it is", () => {
      expect(store.kind).toBe(backend.name);
    });

    it("round-trips a quotation without losing any field", async () => {
      const q = blankQuotation({ clientName: "Shravan Yadav" });
      q.gallery.photos = [{ id: "p1", url: "https://example.com/a.jpg", caption: "Haldi" }];
      await store.insert(q);

      const loaded = await store.getById(q.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.client.name).toBe("Shravan Yadav");
      expect(loaded!.pricing.total).toBe(60000);
      expect(loaded!.team.members).toHaveLength(4);
      expect(loaded!.gallery.photos[0].caption).toBe("Haldi");
      expect(loaded!.terms.items).toEqual(q.terms.items);
    });

    it("finds a quotation by its public slug", async () => {
      const q = blankQuotation({ clientName: "Priya Sahu" });
      await store.insert(q);
      const loaded = await store.getBySlug(q.slug);
      expect(loaded?.id).toBe(q.id);
    });

    it("returns null rather than throwing for an unknown id or slug", async () => {
      expect(await store.getById("nope")).toBeNull();
      expect(await store.getBySlug("nope")).toBeNull();
    });

    it("updates in place and keeps the list summary in step", async () => {
      const q = blankQuotation({ clientName: "Ankit Verma" });
      await store.insert(q);

      q.pricing.total = 145000;
      q.status = "sent";
      q.event.title = "Reception Coverage";
      await store.update(q);

      const loaded = await store.getById(q.id);
      expect(loaded!.pricing.total).toBe(145000);

      const row = (await store.list()).find((r) => r.id === q.id);
      expect(row?.total).toBe(145000);
      expect(row?.status).toBe("sent");
      expect(row?.eventTitle).toBe("Reception Coverage");
    });

    it("prices the summary off the line items when the breakdown is on", async () => {
      const q = blankQuotation({ clientName: "Line Items" });
      q.pricing.showLineItems = true;
      q.pricing.total = 1;
      q.pricing.lineItems = [
        { id: "a", label: "Photography", note: "", amount: 40000 },
        { id: "b", label: "Video", note: "", amount: 30000 },
      ];
      await store.insert(q);

      const row = (await store.list()).find((r) => r.id === q.id);
      expect(row?.total).toBe(70000);
    });

    it("refuses to update a quotation that is not there", async () => {
      const ghost = blankQuotation({ clientName: "Ghost" });
      await expect(store.update(ghost)).rejects.toThrow();
    });

    it("knows when a slug is taken, ignoring the quotation that owns it", async () => {
      const q = blankQuotation({ clientName: "Slug Owner" });
      await store.insert(q);
      expect(await store.slugExists(q.slug)).toBe(true);
      expect(await store.slugExists(q.slug, q.id)).toBe(false);
      expect(await store.slugExists("never-used")).toBe(false);
    });

    it("lists newest first", async () => {
      const rows = await store.list();
      const times = rows.map((r) => new Date(r.updatedAt).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it("returns ISO timestamps whatever the driver hands back", async () => {
      const rows = await store.list();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(new Date(row.updatedAt).toString()).not.toBe("Invalid Date");
        expect(typeof row.updatedAt).toBe("string");
      }
    });

    it("deletes, and says so honestly the second time", async () => {
      const q = blankQuotation({ clientName: "Temporary" });
      await store.insert(q);
      expect(await store.remove(q.id)).toBe(true);
      expect(await store.remove(q.id)).toBe(false);
      expect(await store.getById(q.id)).toBeNull();
    });
  });
}
