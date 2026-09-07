/**
 * End-to-end check against a real `next start` server:
 * auth, create, public render, edit, itemised pricing, slug change,
 * uploads, and delete.
 *
 *   npm run test:e2e      — against SQLite (how you develop)
 *   npm run test:e2e:pg   — against Postgres over the wire (how it deploys)
 *
 * The Postgres run uses PGlite behind a real socket server, so the `pg` driver
 * and the production SQL are both genuinely exercised.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BACKEND = (process.argv.find((a) => a.startsWith("--backend="))?.split("=")[1] || "sqlite");
const PORT = Number(process.env.E2E_PORT || (BACKEND === "postgres" ? 3112 : 3111));
const PG_PORT = Number(process.env.E2E_PG_PORT || 5433);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "e2e-secret";

console.log(`\nRunning end-to-end checks against ${BACKEND}.`);

// Postgres run: stand up a real wire-protocol server in front of PGlite.
let pglite = null;
let pgServer = null;
let databaseUrl = "";

if (BACKEND === "postgres") {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  pglite = new PGlite();
  await pglite.waitReady;
  pgServer = new PGLiteSocketServer({ db: pglite, port: PG_PORT, host: "127.0.0.1" });
  await pgServer.start();
  databaseUrl = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable`;
}

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "wq-e2e-"));
const results = [];
let cookie = "";

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? "✓" : "✗";
  console.log(`  ${mark} ${name}${condition ? "" : `\n      ${detail}`}`);
}

function group(name) {
  console.log(`\n${name}`);
}

async function api(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    redirect: "manual",
    headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML page, not JSON */
  }
  return { status: response.status, headers: response.headers, text, json };
}

/** A real 1x1 PNG, so the upload route's content-type check is exercised honestly. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/admin/login`, { redirect: "manual" });
      if (response.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// A leftover server on this port would silently serve a stale build.
try {
  await fetch(`${BASE}/admin/login`, { redirect: "manual", signal: AbortSignal.timeout(1500) });
  console.error(`Something is already listening on ${BASE}. Stop it (or set E2E_PORT) and retry.`);
  fs.rmSync(workdir, { recursive: true, force: true });
  process.exit(1);
} catch {
  /* Nothing there — good. */
}

const server = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
  cwd: process.cwd(),
  // Own process group, so shutdown takes `next start` down with npm.
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    ADMIN_PASSWORD: PASSWORD,
    AUTH_SALT: "e2e",
    DB_PATH: path.join(workdir, "e2e.db"),
    UPLOAD_DIR: path.join(workdir, "uploads"),
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

let stopped = false;
function shutdown() {
  if (stopped) return;
  stopped = true;
  try {
    // Negative pid kills the whole group; npm alone would orphan next-server.
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGKILL");
  }
  fs.rmSync(workdir, { recursive: true, force: true });
  if (pgServer) pgServer.stop().catch(() => {});
  if (pglite) pglite.close().catch(() => {});
}

process.on("exit", shutdown);
process.on("SIGINT", () => { shutdown(); process.exit(130); });

try {
  if (!(await waitForServer())) {
    console.error("Server never became ready.\n", serverLog);
    shutdown();
    process.exit(1);
  }

  /* ---------------------------------------------------------------- auth */
  group("Access control");
  {
    const unauth = await api("/api/quotations");
    check("admin API rejects an unauthenticated request", unauth.status === 401, `got ${unauth.status}`);

    const adminPage = await api("/admin");
    check(
      "/admin redirects to the sign-in page",
      [302, 307, 308].includes(adminPage.status) && (adminPage.headers.get("location") || "").includes("/admin/login"),
      `status ${adminPage.status}, location ${adminPage.headers.get("location")}`,
    );

    const badLogin = await api("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    check("a wrong password is refused", badLogin.status === 401, `got ${badLogin.status}`);

    const login = await api("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const setCookie = login.headers.get("set-cookie") || "";
    cookie = setCookie.split(";")[0];
    check("the correct password signs in", login.status === 200 && cookie.startsWith("wq_admin="), setCookie);
  }

  /* -------------------------------------------------------------- create */
  group("Creating a quotation");
  let id = "";
  let slug = "";
  {
    const created = await api("/api/quotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientName: "Shravan Yadav" }),
    });
    id = created.json?.quotation?.id || "";
    slug = created.json?.quotation?.slug || "";
    check("creates from the house template", created.status === 201 && Boolean(id), created.text.slice(0, 200));
    check("gets an unguessable share slug", /^shravan-yadav-[a-z0-9]{6}$/.test(slug), slug);
    check("starts as a draft", created.json?.quotation?.status === "draft");
    check("carries the PDF's defaults", created.json?.quotation?.pricing?.total === 60000);

    const list = await api("/api/quotations");
    check("appears in the admin list", list.json?.quotations?.some((r) => r.id === id));
  }

  /* -------------------------------------------------------- public render */
  group("The client's page");
  {
    const saved = cookie;
    cookie = ""; // The client has no session — this must work signed out.
    const page = await api(`/q/${slug}`);
    const html = page.text;

    check("opens without signing in", page.status === 200, `got ${page.status}`);
    check("shows the client's name", html.includes("Shravan Yadav"));
    check("shows the total in Indian formatting", html.includes("60,000"));
    check("shows the amount in words", html.includes("Sixty Thousand Only"));
    check("prices the 30% booking milestone", html.includes("18,000"));
    check("prices the 40% second milestone", html.includes("24,000"));
    check("lists the crew", html.includes("Traditional Photographer") && html.includes("Drone Pilot"));
    check("lists the deliverables", html.includes("premium wedding photo album"));
    check("carries the terms", html.includes("45"));
    check("shows the studio's contact details", html.includes("theweddingsridha@gmail.com"));
    check("offers the WhatsApp shortcut", html.includes("wa.me/918109705662"));
    check("flags an unsent quotation as a draft", html.includes("has not been marked as sent"));
    check("hides the gallery while there are no photos", !html.includes("Our work"));
    check("asks search engines not to index it", /noindex/i.test(html));

    const missing = await api("/q/does-not-exist");
    check("an unknown link 404s rather than erroring", missing.status === 404, `got ${missing.status}`);
    cookie = saved;
  }

  /* ---------------------------------------------------------------- edit */
  group("Editing for this client");
  {
    const current = (await api(`/api/quotations/${id}`)).json.quotation;
    const edited = {
      ...current,
      status: "sent",
      client: { ...current.client, partnerName: "Priya" },
      event: { ...current.event, dates: "12–14 February 2027", venue: "Raipur" },
      pricing: { ...current.pricing, total: 125000, amountInWordsOverride: "" },
      gallery: {
        ...current.gallery,
        photos: [{ id: "p1", url: "/uploads/sample.jpg", caption: "Haldi, Raipur" }],
      },
      team: {
        ...current.team,
        members: [{ id: "t1", count: 2, role: "Candid Photographer", duration: "3 days" }],
      },
    };

    const update = await api(`/api/quotations/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(edited),
    });
    check("saves the edit", update.status === 200, update.text.slice(0, 200));

    const html = (await api(`/q/${slug}`)).text;
    check("shows both names", html.includes("Shravan Yadav &amp; Priya") || html.includes("Shravan Yadav & Priya"));
    check("shows the new total", html.includes("1,25,000"));
    check("recomputes the words from the new total", html.includes("One Lakh Twenty Five Thousand Only"));
    check("recomputes the 30% milestone", html.includes("37,500"));
    check("shows the event dates and venue", html.includes("Raipur"));
    check("reveals the gallery once a photo is added", html.includes("/uploads/sample.jpg"));
    check("keeps the photo caption", html.includes("Haldi, Raipur"));
    check("replaces the crew with the edited one", html.includes("Candid Photographer") && !html.includes("Drone Pilot"));
    check("drops the draft banner once marked sent", !html.includes("has not been marked as sent"));
  }

  /* ----------------------------------------------------- itemised pricing */
  group("Itemised pricing");
  {
    const current = (await api(`/api/quotations/${id}`)).json.quotation;
    await api(`/api/quotations/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...current,
        pricing: {
          ...current.pricing,
          showLineItems: true,
          total: 1, // deliberately stale — the lines must win
          lineItems: [
            { id: "l1", label: "Photography — 3 days", note: "Traditional + candid", amount: 45000 },
            { id: "l2", label: "Cinematography — 3 days", note: "", amount: 35000 },
            { id: "l3", label: "Premium album", note: "35 sheets", amount: 15000 },
          ],
        },
      }),
    });

    const html = (await api(`/q/${slug}`)).text;
    check("shows each line", html.includes("Photography — 3 days") && html.includes("Premium album"));
    check("totals the lines rather than the stale figure", html.includes("95,000") && !html.includes(">₹1<"));
    check("words follow the line total", html.includes("Ninety Five Thousand Only"));
    check("milestones follow the line total", html.includes("28,500") && html.includes("38,000"));
  }

  /* ---------------------------------------------------------- share link */
  group("Changing the share link");
  {
    const current = (await api(`/api/quotations/${id}`)).json.quotation;
    const update = await api(`/api/quotations/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...current, slug: "Shravan & Priya Wedding!" }),
    });
    const newSlug = update.json?.quotation?.slug;
    check("cleans a hand-typed link into a URL-safe one", newSlug === "shravan-priya-wedding", newSlug);

    const fresh = await api(`/q/${newSlug}`);
    check("the new link works", fresh.status === 200);

    const old = await api(`/q/${slug}`);
    check("the old link stops working", old.status === 404, `got ${old.status}`);
    slug = newSlug;
  }

  /* -------------------------------------------------------------- upload */
  group("Photo uploads");
  {
    const form = new FormData();
    form.append("file", new File([PNG_1x1], "shot.png", { type: "image/png" }));
    const upload = await api("/api/upload", { method: "POST", body: form });
    const url = upload.json?.url || "";
    check("accepts a PNG", upload.status === 201 && url.startsWith("/uploads/"), upload.text.slice(0, 200));

    const served = await fetch(`${BASE}${url}`);
    check("serves the uploaded file back", served.status === 200, `got ${served.status}`);

    const badForm = new FormData();
    badForm.append("file", new File(["not an image"], "notes.txt", { type: "text/plain" }));
    const badUpload = await api("/api/upload", { method: "POST", body: badForm });
    check("refuses a non-image", badUpload.status === 415, `got ${badUpload.status}`);

    const traversal = await fetch(`${BASE}/uploads/%2e%2e%2f%2e%2e%2fpackage.json`, { redirect: "manual" });
    check("refuses a path-traversal filename", traversal.status === 404, `got ${traversal.status}`);

    const nested = await fetch(`${BASE}/uploads/nested/shot.jpg`, { redirect: "manual" });
    check("refuses a nested path", nested.status === 404, `got ${nested.status}`);

    const notGenerated = await fetch(`${BASE}/uploads/quotations.db`, { redirect: "manual" });
    check("refuses a name it did not generate", notGenerated.status === 404, `got ${notGenerated.status}`);

    const saved = cookie;
    cookie = "";
    const unauthUpload = await api("/api/upload", { method: "POST", body: new FormData() });
    check("refuses an unauthenticated upload", unauthUpload.status === 401, `got ${unauthUpload.status}`);
    cookie = saved;
  }

  /* -------------------------------------------------------------- delete */
  group("Deleting");
  {
    const removed = await api(`/api/quotations/${id}`, { method: "DELETE" });
    check("deletes the quotation", removed.status === 200);

    const gone = await api(`/q/${slug}`);
    check("the client link goes dead", gone.status === 404, `got ${gone.status}`);
  }
} catch (error) {
  console.error("\nE2E run threw:", error);
  console.error(serverLog.slice(-3000));
  shutdown();
  process.exit(1);
}

shutdown();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed on ${BACKEND}.`);
if (failed.length > 0) {
  console.error(serverLog.slice(-2000));
  process.exit(1);
}
