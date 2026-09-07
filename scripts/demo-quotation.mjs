/** The demo quotation used by both the seed script and the screenshot run. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "demo-assets");

const CAPTIONS = ["Haldi, Raipur", "The baraat", "Varmala", "Vidaai", "Sangeet night", "First look"];

export async function seedDemo(base, cookie) {
  const call = async (pathname, options = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      ...options,
      headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  };

  const upload = async (file) => {
    const form = new FormData();
    form.append("file", new File([fs.readFileSync(path.join(ASSETS, file))], file, { type: "image/jpeg" }));
    const { json } = await call("/api/upload", { method: "POST", body: form });
    return json?.url ?? "";
  };

  const created = await call("/api/quotations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientName: "Shravan Yadav" }),
  });
  const q = created.json?.quotation;
  if (!q) throw new Error("Could not create the demo quotation.");

  const coverUrl = await upload("cover.jpg");
  const photos = [];
  for (let i = 0; i < 6; i += 1) {
    photos.push({ id: `p${i}`, url: await upload(`work-${i + 1}.jpg`), caption: CAPTIONS[i] });
  }

  await call(`/api/quotations/${q.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...q,
      status: "sent",
      studio: { ...q.studio, coverUrl },
      client: { ...q.client, partnerName: "Priya Sahu", phone: "9876543210", email: "shravan@example.com" },
      event: { ...q.event, dates: "12 – 14 February 2027", venue: "Raipur, Chhattisgarh" },
      meta: { quoteNumber: "TWS-2027-014", quoteDate: "7 September 2026", validUntil: "7 October 2026" },
      letter: {
        greeting: "Dear Shravan and Priya,",
        body:
          "Thank you for considering us to photograph your wedding. We spoke about three days in Raipur, and this quotation covers all of it — the haldi, the baraat, the pheras and the vidaai.\n\nEverything below is exactly what you would receive. If anything needs changing, one message is enough.",
      },
      gallery: { ...q.gallery, photos },
      signoff: { ...q.signoff, instagram: "theweddingsridha" },
    }),
  });

  const detail = await call(`/api/quotations/${q.id}`);
  return { id: q.id, slug: detail.json.quotation.slug };
}
