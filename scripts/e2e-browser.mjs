/**
 * Browser-level checks — the things HTTP calls cannot prove: that the editor
 * form actually saves, that the live preview tracks it, that the lightbox
 * opens, and above all that a second device sees what the first one wrote.
 *
 * Runs against Postgres over the wire, the way it is deployed.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.BROWSER_E2E_PORT || 3213);
const PG_PORT = Number(process.env.BROWSER_E2E_PG_PORT || 5435);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "browser-e2e";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok) });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n      ${detail}`}`);
}
function group(name) { console.log(`\n${name}`); }

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "wq-browser-"));

const { PGlite } = await import("@electric-sql/pglite");
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const pglite = new PGlite();
await pglite.waitReady;
const pgServer = new PGLiteSocketServer({ db: pglite, port: PG_PORT, host: "127.0.0.1" });
await pgServer.start();

const server = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
  cwd: path.join(here, ".."),
  detached: true,
  env: {
    ...process.env,
    ADMIN_PASSWORD: PASSWORD,
    AUTH_SALT: "browser-e2e",
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable`,
    UPLOAD_DIR: path.join(workdir, "uploads"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

let stopped = false;
async function shutdown() {
  if (stopped) return;
  stopped = true;
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGKILL"); }
  await pgServer.stop().catch(() => {});
  await pglite.close().catch(() => {});
  fs.rmSync(workdir, { recursive: true, force: true });
}
process.on("exit", () => { shutdown(); });

const deadline = Date.now() + 90000;
let ready = false;
while (Date.now() < deadline && !ready) {
  try { ready = (await fetch(`${BASE}/admin/login`, { redirect: "manual" })).status < 500; }
  catch { /* not up */ }
  if (!ready) await new Promise((r) => setTimeout(r, 400));
}
if (!ready) { console.error("Server never started.\n", serverLog); await shutdown(); process.exit(1); }

const browser = await chromium.launch();
const consoleErrors = [];

try {
  /* ------------------------------------------------- the studio's device */
  group("The studio signs in");
  const studio = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const admin = await studio.newPage();
  admin.on("pageerror", (e) => consoleErrors.push(`admin: ${e}`));

  await admin.goto(`${BASE}/admin`);
  check("an unauthenticated visit lands on the sign-in page", admin.url().includes("/admin/login"), admin.url());

  await admin.getByLabel("Password").fill(PASSWORD);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.waitForURL(`${BASE}/admin`, { timeout: 15000 });
  check("the correct password gets in", admin.url().endsWith("/admin"));

  group("Creating a quotation from the list");
  await admin.getByPlaceholder("Client name").fill("Rohit Sharma");
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/\/admin\/[a-z0-9]+$/, { timeout: 20000 });
  check("it opens straight into the editor", /\/admin\/[a-z0-9]+$/.test(admin.url()), admin.url());

  const preview = admin.locator("article").first();
  await preview.waitFor({ timeout: 15000 });
  check("the client preview renders beside the form", await preview.isVisible());
  check("the preview already shows the new client", (await preview.innerText()).includes("Rohit Sharma"));

  /* ---------------------------------------------------------- live edits */
  group("Editing");
  const clientCard = admin.locator("section").filter({ hasText: "Client & event" }).first();
  await clientCard.getByLabel("Partner name").fill("Anjali Rao");
  await clientCard.getByLabel("Event dates").fill("4 – 6 December 2027");
  await clientCard.getByLabel("Venue / city").fill("Bhilai");

  await admin.waitForFunction(
    () => document.querySelector("article")?.innerText.includes("Anjali Rao"),
    null, { timeout: 10000 },
  );
  check("the preview updates as you type", (await preview.innerText()).includes("Rohit Sharma & Anjali Rao"));
  check("the venue reaches the preview", (await preview.innerText()).includes("Bhilai"));

  const pricingCard = admin.locator("section").filter({ hasText: "Show an itemised breakdown" }).first();
  await pricingCard.getByLabel("Total amount").fill("185000");
  await admin.waitForFunction(
    () => document.querySelector("article")?.innerText.includes("1,85,000"),
    null, { timeout: 10000 },
  );
  const previewText = await preview.innerText();
  check("the total is formatted the Indian way", previewText.includes("₹1,85,000"));
  check("the amount in words follows the total",
    previewText.includes("One Lakh Eighty Five Thousand Only"), previewText.slice(0, 200));
  check("the 30% milestone is repriced", previewText.includes("55,500"));

  group("Autosave");
  await admin.getByText("Saved", { exact: true }).waitFor({ timeout: 20000 });
  check("the editor reports the change as saved", true);

  await admin.reload();
  await admin.locator("article").first().waitFor({ timeout: 15000 });
  const afterReload = await admin.locator("article").first().innerText();
  check("the edit survives a reload", afterReload.includes("₹1,85,000") && afterReload.includes("Anjali Rao"));

  /* -------------------------------------------------------------- upload */
  group("Uploading a photograph");
  const galleryCard = admin.locator("section").filter({ hasText: "Your work" }).first();
  await galleryCard.locator('input[type="file"]').first().setInputFiles(
    path.join(here, "demo-assets", "work-1.jpg"),
  );
  await admin.waitForFunction(
    () => document.querySelectorAll('article img[src*="/uploads/"]').length > 0,
    null, { timeout: 30000 },
  );
  check("the uploaded photo appears in the preview gallery",
    (await admin.locator('article img[src*="/uploads/"]').count()) > 0);

  await admin.getByText("Saved", { exact: true }).waitFor({ timeout: 20000 });

  const shareSlug = await admin.locator("section").filter({ hasText: "Share link" })
    .first().getByLabel("Link ending").inputValue();
  check("the share link is derived from the client's name",
    shareSlug.startsWith("rohit-sharma-"), shareSlug);

  /* --------------------------------------------- a completely other device */
  group("A different device opens the link");
  const clientDevice = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const clientPage = await clientDevice.newPage();
  clientPage.on("pageerror", (e) => consoleErrors.push(`client: ${e}`));

  await clientPage.goto(`${BASE}/q/${shareSlug}`);
  const clientText = await clientPage.locator("article").innerText();
  check("it opens with no session at all — no cookies from the studio",
    (await clientDevice.cookies()).length === 0);
  check("the phone sees what the laptop typed", clientText.includes("Rohit Sharma & Anjali Rao"));
  check("including the price", clientText.includes("₹1,85,000"));
  check("including the venue", clientText.includes("Bhilai"));
  check("and the photograph the studio just uploaded",
    (await clientPage.locator('img[src*="/uploads/"]').count()) > 0);

  const photo = clientPage.locator('img[src*="/uploads/"]').first();
  check("the photo actually loaded, not a broken image",
    await photo.evaluate((img) => img.naturalWidth > 0));

  group("A later change reaches that device too");
  await admin.locator("section").filter({ hasText: "Client & event" }).first()
    .getByLabel("Venue / city").fill("Raipur");
  await admin.waitForFunction(
    () => document.querySelector("article")?.innerText.includes("Raipur"),
    null, { timeout: 10000 },
  );
  await admin.getByText("Saved", { exact: true }).waitFor({ timeout: 20000 });

  await clientPage.reload();
  const refreshed = await clientPage.locator("article").innerText();
  check("the second device picks up the new venue on refresh", refreshed.includes("Raipur"));
  check("and no longer shows the old one", !refreshed.includes("Bhilai"));

  /* ------------------------------------------------------ client page UI */
  group("The client page works on a phone");
  await clientPage.locator('button[aria-label*="Open photo"], button[aria-label]').first().click();
  const lightbox = clientPage.locator('[role="dialog"]');
  await lightbox.waitFor({ timeout: 10000 });
  check("tapping a photo opens the lightbox", await lightbox.isVisible());
  await clientPage.getByRole("button", { name: "Close" }).click();
  check("and it closes again", (await lightbox.count()) === 0);

  const whatsapp = clientPage.locator('a[href*="wa.me"]').first();
  check("the WhatsApp button points at the studio's number",
    (await whatsapp.getAttribute("href"))?.includes("wa.me/918109705662"));
  const tel = clientPage.locator('a[href^="tel:"]').first();
  check("the call button dials the studio", (await tel.getAttribute("href"))?.includes("8109705662"));
  check("the page never scrolls sideways on a phone",
    await clientPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  /* -------------------------------------------------- editor on a phone */
  group("The editor on a phone");
  const phoneStudio = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phoneAdmin = await phoneStudio.newPage();
  await phoneAdmin.goto(`${BASE}/admin/login`);
  await phoneAdmin.getByLabel("Password").fill(PASSWORD);
  await phoneAdmin.getByRole("button", { name: "Sign in" }).click();
  await phoneAdmin.waitForURL(`${BASE}/admin`, { timeout: 15000 });
  await phoneAdmin.getByText("Rohit Sharma").first().click();
  await phoneAdmin.waitForURL(/\/admin\/[a-z0-9]+$/, { timeout: 20000 });

  check("the form is what you see first", await phoneAdmin.getByText("Client & event").isVisible());
  await phoneAdmin.getByRole("button", { name: "Client preview" }).click();
  await phoneAdmin.locator("article").first().waitFor({ timeout: 10000 });
  check("the preview tab shows the client page", await phoneAdmin.locator("article").first().isVisible());
  await phoneAdmin.getByRole("button", { name: "Edit" }).click();
  check("and you can switch back to editing", await phoneAdmin.getByText("Client & event").isVisible());
  check("the editor never scrolls sideways either",
    await phoneAdmin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  /* ------------------------------------------------------------- delete */
  group("Deleting");
  await admin.goto(`${BASE}/admin`);
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Delete" }).first().click();
  await admin.waitForTimeout(1500);
  check("the row disappears from the list",
    !(await admin.locator("li").filter({ hasText: "Rohit Sharma" }).count()));

  const dead = await clientPage.goto(`${BASE}/q/${shareSlug}`);
  check("and the client link goes dead", dead.status() === 404, `got ${dead.status()}`);

  check("no JavaScript errors anywhere in the run",
    consoleErrors.length === 0, consoleErrors.join("\n"));
} catch (error) {
  console.error("\nBrowser run threw:", error);
  console.error(serverLog.slice(-2000));
  await browser.close().catch(() => {});
  await shutdown();
  process.exit(1);
}

await browser.close();
await shutdown();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed.`);
if (failed.length > 0) process.exit(1);
