/**
 * How a serverless deployment behaves before it is fully configured. Every one
 * of these used to be a blank 500, which tells you nothing while quietly
 * risking the studio's data.
 *
 *   1. No database at all      -> the admin explains what to add; nothing is lost.
 *   2. POSTGRES_URL, no Blob   -> works, with uploads disabled and said so.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok) });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n      ${detail}`}`);
}

async function withServer({ port, env }, run) {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "wq-sls-"));
  const server = spawn("npm", ["run", "start", "--", "--port", String(port)], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      VERCEL: "1", // Pretend we are on a function runtime with no writable disk.
      ADMIN_PASSWORD: "",
      DATABASE_URL: "",
      DB_PATH: path.join(workdir, "should-never-be-created.db"),
      UPLOAD_DIR: path.join(workdir, "uploads"),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  server.stdout.on("data", (d) => { log += d; });
  server.stderr.on("data", (d) => { log += d; });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = (await fetch(`${base}/admin`, { redirect: "manual" })).status > 0; }
    catch { /* not up yet */ }
    if (!ready) await new Promise((r) => setTimeout(r, 400));
  }

  try {
    await run({ base, workdir, log: () => log });
  } finally {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGKILL"); }
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

/* ------------------------------------------- 1. deployed with no database */
console.log("\nDeployed with no database configured");
await withServer({ port: 3211, env: {} }, async ({ base, workdir }) => {
  const admin = await fetch(`${base}/admin`);
  const adminHtml = await admin.text();
  check("the admin answers instead of failing with a blank error page",
    admin.status === 200, `got ${admin.status}`);
  check("it says a database is missing",
    adminHtml.includes("This deployment has no database yet"));
  check("it lists the variables it accepts",
    adminHtml.includes("DATABASE_URL") && adminHtml.includes("POSTGRES_URL"));
  check("it tells you to redeploy after adding them",
    adminHtml.includes("Redeploy"));

  const api = await fetch(`${base}/api/quotations`);
  const apiBody = await api.json().catch(() => ({}));
  check("the API returns 503, not an unhandled crash", api.status === 503, `got ${api.status}`);
  check("and flags it as a setup problem", apiBody.setupRequired === true, JSON.stringify(apiBody));

  const health = await (await fetch(`${base}/api/health`)).json();
  check("health reports no connection string was found", health.database.configuredVia === null);
  check("health reports the app is not ok", health.ok === false);

  const client = await fetch(`${base}/q/anything`);
  const clientHtml = await client.text();
  check("a client sees a calm message, not setup instructions",
    clientHtml.includes("Just a moment") && !clientHtml.includes("DATABASE_URL"));

  const form = new FormData();
  form.append("file", new File([Buffer.from("x")], "a.png", { type: "image/png" }));
  const upload = await fetch(`${base}/api/upload`, { method: "POST", body: form });
  check("with no database at all, an upload is refused rather than written somewhere temporary",
    upload.status === 501, `got ${upload.status}`);

  check("no SQLite file is created on a host that cannot keep one",
    !fs.existsSync(path.join(workdir, "should-never-be-created.db")));
});

/* ------------------- 2. connected through POSTGRES_URL, with no Blob store */
console.log("\nConnected via an unrecognised variable name, no Blob store");
const { PGlite } = await import("@electric-sql/pglite");
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const pglite = new PGlite();
await pglite.waitReady;
const pgServer = new PGLiteSocketServer({ db: pglite, port: 5434, host: "127.0.0.1" });
await pgServer.start();

try {
  await withServer(
    {
      port: 3212,
      // Deliberately an unknown prefix — this is what Neon's Vercel integration
      // produces when the prefix is left as STORAGE.
      env: { STORAGE_URL: "postgres://postgres:postgres@127.0.0.1:5434/postgres?sslmode=disable" },
    },
    async ({ base }) => {
      const health = await (await fetch(`${base}/api/health`)).json();
      check("the app finds a Postgres URL under a name it has never seen",
        health.database.configuredVia === "STORAGE_URL", JSON.stringify(health.database));
      check("and reaches the database", health.database.reachable === true, health.database.error || "");

      const created = await fetch(`${base}/api/quotations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName: "Meera Nair" }),
      });
      const payload = await created.json().catch(() => ({}));
      check("quotations save", created.status === 201 && payload.quotation?.id,
        JSON.stringify(payload).slice(0, 200));

      // A real PNG, so what comes back out can be compared byte for byte.
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      );
      const form = new FormData();
      form.append("file", new File([png], "a.png", { type: "image/png" }));
      const upload = await fetch(`${base}/api/upload`, { method: "POST", body: form });
      const uploadBody = await upload.json().catch(() => ({}));
      check("uploads work with only a database — no object storage needed",
        upload.status === 201 && (uploadBody.url || "").startsWith("/uploads/"),
        `${upload.status} ${JSON.stringify(uploadBody).slice(0, 160)}`);

      const served = await fetch(`${base}${uploadBody.url}`);
      const servedBytes = Buffer.from(await served.arrayBuffer());
      check("the photograph is served back", served.status === 200, `got ${served.status}`);
      check("with the right content type",
        (served.headers.get("content-type") || "").includes("image/png"),
        served.headers.get("content-type") || "");
      check("byte for byte identical to what was uploaded", servedBytes.equals(png));

      const tooBig = new FormData();
      tooBig.append("file", new File([Buffer.alloc(4 * 1024 * 1024)], "big.png", { type: "image/png" }));
      const bigUpload = await fetch(`${base}/api/upload`, { method: "POST", body: tooBig });
      const bigBody = await bigUpload.json().catch(() => ({}));
      check("an image too large to serve back through a function is refused up front",
        bigUpload.status === 413, `got ${bigUpload.status}`);
      check("and the refusal explains how to raise the limit",
        /Blob/.test(bigBody.error || ""), bigBody.error);

      const adminHtml = await (await fetch(`${base}/admin`)).text();
      check("the admin no longer claims uploads are off",
        !adminHtml.includes("Photo uploads are turned off"));
      check("the admin reports photos go to Postgres", adminHtml.includes("photos in Postgres"));
      check("the admin reports quotations are in Postgres", adminHtml.includes("stored in Postgres"));

      // Pasted image URLs are the documented workaround — they must still render.
      const q = payload.quotation;
      await fetch(`${base}/api/quotations/${q.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...q,
          gallery: { ...q.gallery, photos: [{ id: "x", url: "https://example.com/photo.jpg", caption: "" }] },
        }),
      });
      const clientHtml = await (await fetch(`${base}/q/${q.slug}`)).text();
      check("a pasted photo URL still shows on the client page",
        clientHtml.includes("https://example.com/photo.jpg"));
    },
  );
} finally {
  await pgServer.stop().catch(() => {});
  await pglite.close().catch(() => {});
}

/* --------------- 3. Blob connected under a prefixed variable name */
console.log("\nBlob store connected under a prefixed variable name");
const pglite2 = new PGlite();
await pglite2.waitReady;
const pgServer2 = new PGLiteSocketServer({ db: pglite2, port: 5436, host: "127.0.0.1" });
await pgServer2.start();

try {
  await withServer(
    {
      port: 3214,
      env: {
        STORAGE_URL: "postgres://postgres:postgres@127.0.0.1:5436/postgres?sslmode=disable",
        // Not BLOB_READ_WRITE_TOKEN: the prefix is chosen when the store is
        // connected, exactly as it is for Postgres. The token's own format is
        // what identifies it.
        STORAGE_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_FakeStoreId_0123456789abcdef",
      },
    },
    async ({ base }) => {
      const health = await (await fetch(`${base}/api/health`)).json();
      check("the Blob token is found under a name the code has never seen",
        health.uploads.configuredVia === "STORAGE_BLOB_READ_WRITE_TOKEN",
        JSON.stringify(health.uploads));
      check("uploads switch to the Blob backend", health.uploads.backend === "blob");

      const adminHtml = await (await fetch(`${base}/admin`)).text();
      check("the admin no longer warns that uploads are off",
        !adminHtml.includes("Photo uploads are turned off"));
      check("the admin reports photos go to Blob", adminHtml.includes("photos in Vercel Blob"));

      // The token is fake, so the store must reject it — and that rejection has
      // to surface as a readable message rather than a crash.
      const form = new FormData();
      form.append("file", new File([Buffer.from("x")], "a.png", { type: "image/png" }));
      const upload = await fetch(`${base}/api/upload`, { method: "POST", body: form });
      const body = await upload.json().catch(() => ({}));
      check("a rejected upload returns a readable error, not a crash",
        upload.status === 502 && /photo store rejected/i.test(body.error || ""),
        `${upload.status} ${JSON.stringify(body).slice(0, 160)}`);
    },
  );
} finally {
  await pgServer2.stop().catch(() => {});
  await pglite2.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} deployment-safety checks passed.`);
if (failed.length > 0) process.exit(1);
