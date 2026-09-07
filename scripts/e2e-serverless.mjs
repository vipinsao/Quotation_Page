/**
 * The two ways a Vercel deployment can be misconfigured. Both must fail in a
 * way you can see, because the alternative — quietly writing to a disk that
 * disappears — loses the studio's quotations without anyone noticing.
 *
 *   1. No DATABASE_URL on a serverless host  -> the app refuses to serve.
 *   2. No Blob token                         -> uploads say so; everything else works.
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
    try {
      const r = await fetch(`${base}/admin`, { redirect: "manual" });
      ready = r.status > 0;
    } catch { /* not up yet */ }
    if (!ready) await new Promise((r) => setTimeout(r, 400));
  }

  try {
    await run({ base, workdir, log: () => log });
  } finally {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGKILL"); }
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

/* ---------------------------------------- 1. serverless with no database */
console.log("\nServerless with no DATABASE_URL");
await withServer({ port: 3211, env: {} }, async ({ base, workdir, log }) => {
  const admin = await fetch(`${base}/admin`, { redirect: "manual" });
  check("the admin refuses to serve rather than using a disposable database",
    admin.status >= 500, `got ${admin.status}`);

  const api = await fetch(`${base}/api/quotations`);
  check("the API fails too, instead of returning an empty list",
    api.status >= 500, `got ${api.status}`);

  check("the reason is written to the server log",
    /DATABASE_URL is not set/.test(log()), log().slice(-400));

  check("no SQLite file is created on a host that cannot keep one",
    !fs.existsSync(path.join(workdir, "should-never-be-created.db")));
});

/* ------------------------------------- 2. serverless with no blob storage */
console.log("\nServerless with Postgres but no Blob store");
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
      env: { DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5434/postgres?sslmode=disable" },
    },
    async ({ base }) => {
      const created = await fetch(`${base}/api/quotations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName: "Meera Nair" }),
      });
      const payload = await created.json().catch(() => ({}));
      check("quotations still save, because Postgres is configured",
        created.status === 201 && payload.quotation?.id, JSON.stringify(payload).slice(0, 200));

      const form = new FormData();
      form.append("file", new File([Buffer.from("x")], "a.png", { type: "image/png" }));
      const upload = await fetch(`${base}/api/upload`, { method: "POST", body: form });
      const uploadBody = await upload.json().catch(() => ({}));
      check("an upload is refused with a 501 rather than written somewhere temporary",
        upload.status === 501, `got ${upload.status}`);
      check("the refusal explains what to add",
        /BLOB_READ_WRITE_TOKEN/.test(uploadBody.error || ""), uploadBody.error);

      const adminHtml = await (await fetch(`${base}/admin`)).text();
      check("the admin warns that uploads are off", adminHtml.includes("Photo uploads are turned off"));
      check("the admin reports it is using Postgres", adminHtml.includes("stored in Postgres"));

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

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} deployment-safety checks passed.`);
if (failed.length > 0) process.exit(1);
