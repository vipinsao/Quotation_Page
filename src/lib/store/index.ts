import path from "node:path";
import { createPostgresStore } from "./postgres";
import { createSqliteStore } from "./sqlite";
import type { QuotationStore } from "./types";

/** Vercel and other function runtimes have no writable, persistent disk. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function storeKind(): "sqlite" | "postgres" {
  return process.env.DATABASE_URL ? "postgres" : "sqlite";
}

async function build(): Promise<QuotationStore> {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: databaseUrl,
      // Serverless invocations are short-lived; a wide pool per instance just
      // burns connections. Use the provider's pooled URL for real concurrency.
      max: Number(process.env.PGPOOL_MAX || 1),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: databaseUrl.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false },
    });
    return createPostgresStore(pool);
  }

  if (isServerless()) {
    // Falling back to SQLite here would appear to work and then silently drop
    // every quotation, which is worse than refusing to start.
    throw new Error(
      "DATABASE_URL is not set. This deployment has no persistent disk, so SQLite " +
        "cannot be used — add a Postgres connection string (Neon, Vercel Postgres, " +
        "Supabase) to the project's environment variables.",
    );
  }

  return createSqliteStore(process.env.DB_PATH || path.join(process.cwd(), "data", "quotations.db"));
}

// Cached on globalThis so Next's dev hot-reload does not open a new pool each time.
const globalForStore = globalThis as unknown as { __quotationStore?: Promise<QuotationStore> };

export function getStore(): Promise<QuotationStore> {
  globalForStore.__quotationStore ??= build().catch((error) => {
    // Never cache the failure — a misconfigured deploy should recover as soon
    // as the environment is fixed, without needing a redeploy.
    globalForStore.__quotationStore = undefined;
    throw error;
  });
  return globalForStore.__quotationStore;
}
