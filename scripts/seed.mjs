/**
 * Puts one finished example quotation into the local database, so there is
 * something real to look at the first time you open the admin.
 * Run with `npm run seed` (after `npm run build`).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedDemo } from "./demo-quotation.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SEED_PORT || 3333);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
  cwd: path.join(here, ".."),
  detached: true,
  // No ADMIN_PASSWORD: the seeder talks to the same unlocked local admin you do.
  env: { ...process.env, ADMIN_PASSWORD: "" },
  stdio: ["ignore", "pipe", "pipe"],
});

let stopped = false;
function shutdown() {
  if (stopped) return;
  stopped = true;
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGKILL"); }
}
process.on("exit", shutdown);

const deadline = Date.now() + 90000;
let ready = false;
while (Date.now() < deadline && !ready) {
  try {
    const r = await fetch(`${BASE}/admin`, { redirect: "manual" });
    ready = r.status < 500;
  } catch { /* not up yet */ }
  if (!ready) await new Promise((r) => setTimeout(r, 400));
}

if (!ready) {
  console.error("Server never started. Run `npm run build` first.");
  shutdown();
  process.exit(1);
}

try {
  const { id, slug } = await seedDemo(BASE, "");
  console.log("\nSeeded an example quotation.\n");
  console.log(`  Admin editor: http://localhost:3000/admin/${id}`);
  console.log(`  Client page:  http://localhost:3000/q/${slug}\n`);
  console.log("Start the app with `npm run dev` and open the admin.\n");
} catch (error) {
  console.error("Seeding failed:", error);
  shutdown();
  process.exit(1);
}

shutdown();
