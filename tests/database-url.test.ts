import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseUrlCandidates, databaseUrlSource, storeKind } from "@/lib/store";

const KEYS = [
  "DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "DATABASE_POSTGRES_URL",
  "POSTGRES_PRISMA_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING",
  "STORAGE_URL", "STORAGE_URL_UNPOOLED", "MY_WEIRD_PREFIX_URL", "NOT_A_DB", "STORAGE_PGHOST",
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const URL_A = "postgres://user:pass@a.neon.tech/db?sslmode=require";
const URL_B = "postgresql://user:pass@b.neon.tech/db?sslmode=require";

describe("finding the connection string", () => {
  it("finds nothing when there is nothing to find", () => {
    expect(databaseUrlSource()).toBeNull();
    expect(storeKind()).toBe("sqlite");
  });

  it("prefers DATABASE_URL above everything else", () => {
    process.env.POSTGRES_URL = URL_B;
    process.env.DATABASE_URL = URL_A;
    expect(databaseUrlSource()).toBe("DATABASE_URL");
  });

  it("uses POSTGRES_URL, which is what the Vercel integrations actually set", () => {
    process.env.POSTGRES_URL = URL_A;
    expect(databaseUrlSource()).toBe("POSTGRES_URL");
    expect(storeKind()).toBe("postgres");
  });

  it("picks up a prefix it has never heard of", () => {
    // Connecting Neon through Vercel lets you choose the prefix; STORAGE_URL is
    // what you get if you leave it on "STORAGE".
    process.env.STORAGE_URL = URL_A;
    expect(databaseUrlSource()).toBe("STORAGE_URL");
    expect(storeKind()).toBe("postgres");
  });

  it("prefers the pooled endpoint over the unpooled one", () => {
    process.env.STORAGE_URL_UNPOOLED = URL_B;
    process.env.STORAGE_URL = URL_A;
    expect(databaseUrlSource()).toBe("STORAGE_URL");
  });

  it("falls back to an unpooled URL rather than refusing to start", () => {
    process.env.STORAGE_URL_UNPOOLED = URL_B;
    expect(databaseUrlSource()).toBe("STORAGE_URL_UNPOOLED");
  });

  it("ignores variables that merely look database-ish", () => {
    process.env.NOT_A_DB = "hello";
    process.env.STORAGE_PGHOST = "a.neon.tech";
    expect(databaseUrlSource()).toBeNull();
  });

  it("ignores a known name that is set but empty", () => {
    process.env.DATABASE_URL = "   ";
    process.env.STORAGE_URL = URL_A;
    expect(databaseUrlSource()).toBe("STORAGE_URL");
  });

  it("accepts both postgres:// and postgresql://", () => {
    process.env.MY_WEIRD_PREFIX_URL = URL_B;
    expect(databaseUrlSource()).toBe("MY_WEIRD_PREFIX_URL");
  });

  it("lists every candidate by name for diagnostics, never their values", () => {
    process.env.STORAGE_URL = URL_A;
    process.env.POSTGRES_URL = URL_B;
    const found = databaseUrlCandidates();
    expect(found).toContain("STORAGE_URL");
    expect(found).toContain("POSTGRES_URL");
    expect(found.join(" ")).not.toContain("pass");
  });
});
