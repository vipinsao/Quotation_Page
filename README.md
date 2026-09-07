# The Wedding Sridha — Quotations

Replaces the Word/PDF quotation with a link. The studio edits a quotation in the
admin, sends one URL, and the client opens a page that reads well on a phone,
shows the studio's photographs, and saves to PDF if they want a copy.

Built from the studio's existing quotation PDF — the default template is that
document's exact content, so a new quotation starts finished and only needs the
per-client details changed.

## Two pages

| Page | Who | What it does |
| --- | --- | --- |
| `/q/<link>` | The client | The quotation. No login. Photographs, inclusions, crew, deliverables, the total in figures and words, the payment schedule, terms, and one tap to WhatsApp or call. |
| `/admin/<id>` | The studio | Every field of that quotation, with a live client preview beside it. Autosaves. |

`/admin` lists every quotation, and creates or duplicates one.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000/admin
```

To see a finished example rather than an empty list:

```bash
npm run build
npm run seed         # adds one complete quotation with photographs
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Configuration

Copy `.env.example` to `.env`.

| Variable | Default | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | *(empty)* | Empty means the admin is unlocked — fine locally. **Set it before putting this on the internet.** |
| `AUTH_SALT` | `the-wedding-sridha` | Change it; signing out everyone is as simple as changing it again. |
| `DB_PATH` | `./data/quotations.db` | SQLite file. |
| `UPLOAD_DIR` | `./data/uploads` | Uploaded photographs. |

Deploying to a host with ephemeral disk (Render, Fly, Railway): mount a
persistent disk and point `DB_PATH` and `UPLOAD_DIR` inside it, or the
quotations and photographs disappear on the next deploy.

## How it fits together

- **One renderer.** `components/quotation/QuotationView.tsx` draws both the
  client page and the admin's live preview, so the preview cannot drift from
  what the client actually sees.
- **Normalize on the way in.** `lib/normalize.ts` coerces whatever the editor
  sends into a complete quotation — blank rows dropped, `₹1,25,000` parsed to a
  number, ids filled in — so the view never has to defend itself.
- **Derived, never stored twice.** `lib/compute.ts` computes the total, the
  amount in words and every payment amount from the source figures. Switching
  on the itemised breakdown makes the line items the total; percentages become
  rupees with the last milestone absorbing the rounding, so the schedule always
  sums to the total exactly.
- **Indian numbering.** `lib/money.ts` writes amounts in lakh/crore, the way the
  original PDF does.
- **Uploads live outside `public/`.** Next only serves `public/` as it was at
  build time, so anything uploaded afterwards would 404 in production. Files go
  to `UPLOAD_DIR` and are streamed by `/uploads/[...path]`, which accepts only
  the UUID filenames this app generates.
- **Share links are unguessable.** `shravan-yadav-a4f9` — one client's link
  cannot be walked to another's, which matters when links get forwarded on
  WhatsApp. Client pages also send `noindex`.

## Tests

```bash
npm test             # 30 unit tests — money, normalization, derived values
npm run test:e2e     # 50 checks against a real built server
npm run test:all     # both, with a build in between
```

The end-to-end run boots `next start` on a scratch database and exercises
access control, creating, the public render, editing, itemised pricing,
changing a share link, uploads (including path-traversal attempts) and delete.

```bash
npm run preview:shots -- ./shots
```

Seeds a realistic quotation and screenshots the client page (desktop, phone,
print) and the admin, and reports any browser console errors.
