import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blobTokenCandidates, blobTokenSource, uploadBackend } from "@/lib/storage";

const KEYS = [
  "BLOB_READ_WRITE_TOKEN",
  "STORAGE_BLOB_READ_WRITE_TOKEN",
  "MYPREFIX_READ_WRITE_TOKEN",
  "SOME_OTHER_TOKEN",
  "VERCEL",
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

const TOKEN = "vercel_blob_rw_AbC123storeid_deadbeefdeadbeef";

describe("finding the Blob token", () => {
  it("finds nothing when no store is connected", () => {
    expect(blobTokenSource()).toBeNull();
  });

  it("uses the documented name when it is there", () => {
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    expect(blobTokenSource()).toBe("BLOB_READ_WRITE_TOKEN");
  });

  it("finds the token under a prefix it has never seen", () => {
    // Connecting a Blob store lets you choose the prefix, exactly as the
    // Postgres integration does.
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN = TOKEN;
    expect(blobTokenSource()).toBe("STORAGE_BLOB_READ_WRITE_TOKEN");
  });

  it("recognises the token by its own format, not by the variable name", () => {
    process.env.MYPREFIX_READ_WRITE_TOKEN = TOKEN;
    expect(blobTokenSource()).toBe("MYPREFIX_READ_WRITE_TOKEN");
  });

  it("ignores variables that hold something else entirely", () => {
    process.env.SOME_OTHER_TOKEN = "ghp_not_a_blob_token";
    expect(blobTokenSource()).toBeNull();
  });

  it("prefers the documented name when several are present", () => {
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN = TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    expect(blobTokenSource()).toBe("BLOB_READ_WRITE_TOKEN");
  });

  it("lists candidates by name only, never leaking the token", () => {
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN = TOKEN;
    const found = blobTokenCandidates();
    expect(found).toEqual(["STORAGE_BLOB_READ_WRITE_TOKEN"]);
    expect(found.join(" ")).not.toContain("deadbeef");
  });

  it("switches the upload backend to blob once a token is found anywhere", () => {
    process.env.VERCEL = "1";
    expect(uploadBackend()).toBe("unavailable");
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN = TOKEN;
    expect(uploadBackend()).toBe("blob");
  });
});
