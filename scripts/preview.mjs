/**
 * Boots the built app on a scratch database, seeds a realistic quotation with
 * photographs, and screenshots the client page and the admin editor.
 * Run with `npm run preview:shots -- <outputDir>`.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { seedDemo } from "./demo-quotation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(here, "..", "shots"));
const PORT = Number(process.env.PREVIEW_PORT || 3222);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "preview";

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "wq-preview-"));
fs.mkdirSync(OUT, { recursive: true });

const server = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
  cwd: path.join(here, ".."),
  detached: true,
  env: {
    ...process.env,
    ADMIN_PASSWORD: PASSWORD,
    AUTH_SALT: "preview",
    DB_PATH: path.join(workdir, "preview.db"),
    UPLOAD_DIR: path.join(workdir, "uploads"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stopped = false;
function shutdown() {
  if (stopped) return;
  stopped = true;
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGKILL"); }
  fs.rmSync(workdir, { recursive: true, force: true });
}
process.on("exit", shutdown);

let cookie = "";
async function api(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
  });
  return { status: response.status, json: await response.json().catch(() => null), response };
}

async function waitForServer() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/admin/login`, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

try {
  if (!(await waitForServer())) throw new Error("server never started");

  const login = await api("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  cookie = (login.response.headers.get("set-cookie") || "").split(";")[0];

  const { id, slug } = await seedDemo(BASE, cookie);

  const browser = await chromium.launch();

  // Client page — desktop
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await desktop.goto(`${BASE}/q/${slug}`, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: path.join(OUT, "client-desktop-hero.png") });
  await desktop.screenshot({ path: path.join(OUT, "client-desktop-full.png"), fullPage: true });

  // Client page — phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto(`${BASE}/q/${slug}`, { waitUntil: "networkidle" });
  await phone.screenshot({ path: path.join(OUT, "client-mobile-full.png"), fullPage: true });

  // Print rendering — what "Save as PDF" actually produces
  await desktop.emulateMedia({ media: "print" });
  await desktop.pdf({ path: path.join(OUT, "client-print.pdf"), format: "A4", printBackground: true });

  // The same thing as an image, at A4 width, so the print layout can be reviewed.
  const paper = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await paper.emulateMedia({ media: "print" });
  await paper.goto(`${BASE}/q/${slug}`, { waitUntil: "networkidle" });
  await paper.screenshot({ path: path.join(OUT, "client-print-view.png"), fullPage: true });
  await paper.close();

  await desktop.emulateMedia({ media: "screen" });

  // Admin
  const admin = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  await admin.context().addCookies([
    { name: cookie.split("=")[0], value: cookie.split("=").slice(1).join("="), url: BASE },
  ]);
  await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await admin.screenshot({ path: path.join(OUT, "admin-list.png") });

  await admin.goto(`${BASE}/admin/${id}`, { waitUntil: "networkidle" });
  await admin.screenshot({ path: path.join(OUT, "admin-editor.png") });

  const adminPhone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await adminPhone.context().addCookies([
    { name: cookie.split("=")[0], value: cookie.split("=").slice(1).join("="), url: BASE },
  ]);
  await adminPhone.goto(`${BASE}/admin/${id}`, { waitUntil: "networkidle" });
  await adminPhone.screenshot({ path: path.join(OUT, "admin-editor-mobile.png") });

  // Surface any browser console errors — a silently broken page still screenshots fine.
  const errors = [];
  desktop.on("pageerror", (e) => errors.push(String(e)));
  await desktop.reload({ waitUntil: "networkidle" });

  await browser.close();
  console.log(`Screenshots written to ${OUT}`);
  console.log(errors.length ? `Page errors: ${errors.join("\n")}` : "No page errors.");
} catch (error) {
  console.error("Preview failed:", error);
  shutdown();
  process.exit(1);
}

shutdown();
