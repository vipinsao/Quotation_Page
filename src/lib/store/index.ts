import path from "node:path";
import { createPostgresStore } from "./postgres";
import { createSqliteStore } from "./sqlite";
import type { QuotationStore } from "./types";

/** Vercel and other function runtimes have no writable, persistent disk. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Connecting a Postgres database through a host's storage tab does not always
 * set DATABASE_URL — Vercel's Neon and Postgres integrations set POSTGRES_URL
 * and friends. Accepting the usual names means "connect the database, redeploy"
 * is genuinely all there is to it. Pooled URLs come first: serverless opens a
 * connection per instance.
 */
export const DATABASE_ENV_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
  "DATABASE_POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//i;

/** Direct/unpooled endpoints are a poor fit for serverless; prefer pooled ones. */
const UNPOOLED_HINT = /(UNPOOLED|NON_POOLING|NONPOOLING|DIRECT)/i;

/**
 * Storage integrations let you choose the variable prefix, so the name is not
 * something this app can rely on — connecting Neon through Vercel can produce
 * STORAGE_URL just as easily as DATABASE_URL. Known names win, and anything
 * else in the environment holding a postgres:// URL is picked up as a
 * fallback, so "connect the database and redeploy" is genuinely all there is.
 */
export function databaseUrlSource(): string | null {
  for (const key of DATABASE_ENV_VARS) {
    const value = process.env[key]?.trim();
    if (value && POSTGRES_URL_PATTERN.test(value)) return key;
  }

  const discovered = Object.keys(process.env)
    .filter((key) => POSTGRES_URL_PATTERN.test(process.env[key]?.trim() ?? ""))
    .sort((a, b) => {
      const pooled = Number(UNPOOLED_HINT.test(a)) - Number(UNPOOLED_HINT.test(b));
      return pooled !== 0 ? pooled : a.localeCompare(b);
    });

  return discovered[0] ?? null;
}

export function databaseUrl(): string | null {
  const key = databaseUrlSource();
  const value = key ? process.env[key]?.trim() : null;
  return value || null;
}

/** Every environment variable currently holding a Postgres URL, for diagnostics. */
export function databaseUrlCandidates(): string[] {
  return Object.keys(process.env)
    .filter((key) => POSTGRES_URL_PATTERN.test(process.env[key]?.trim() ?? ""))
    .sort();
}

export function storeKind(): "sqlite" | "postgres" {
  return databaseUrl() ? "postgres" : "sqlite";
}

/** Thrown when the app cannot safely store anything. Rendered, not swallowed. */
export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

async function build(): Promise<QuotationStore> {
  const url = databaseUrl();

  if (url) {
    const databaseUrl = url;
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
    throw new StorageNotConfiguredError(
      "No Postgres connection string found. This deployment has no persistent disk, " +
        "so SQLite cannot be used. Checked: " + DATABASE_ENV_VARS.join(", ") + ".",
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
