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

Copy `.env.example` to `.env`. Local development needs none of it.

| Variable | Default | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | *(empty)* | Empty means the admin is unlocked — fine locally. **Required before this is reachable from the internet.** |
| `AUTH_SALT` | `the-wedding-sridha` | Changing it signs everyone out. |
| `DATABASE_URL` | *(unset)* | Postgres. When set, it is used instead of SQLite. `POSTGRES_URL`, `NEON_DATABASE_URL`, `POSTGRES_PRISMA_URL` and the un-pooled variants are accepted too, because that is what the hosts' storage integrations actually set. |
| `BLOB_READ_WRITE_TOKEN` | *(unset)* | Vercel Blob. When set, photos go there instead of the local disk. |
| `DB_PATH` | `./data/quotations.db` | Local SQLite file. Ignored when `DATABASE_URL` is set. |
| `UPLOAD_DIR` | `./data/uploads` | Local photo directory. Ignored when Blob is configured. |

## Deploying to Vercel

Vercel functions have no persistent disk, so SQLite and local file uploads
cannot be used there — a deployment without the two services below would appear
to work and then lose every quotation. The app refuses to start rather than let
that happen.

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). No build
   settings to change.
2. **Add Postgres.** In the project, Storage → create a Neon Postgres database
   and connect it. That sets `DATABASE_URL` for you. If you bring your own,
   use the **pooled** connection string. The table is created on first use —
   there is no migration step.
3. **Add Blob.** Storage → create a Blob store and connect it. That sets
   `BLOB_READ_WRITE_TOKEN`. Skip this and quotations still work, but the upload
   button is disabled and you paste image URLs instead — the admin says so.
4. **Set `ADMIN_PASSWORD`** and `AUTH_SALT` in Settings → Environment
   Variables, for all environments.
5. Redeploy.

The admin page states which database and photo storage it is actually using, so
a misconfigured deploy is visible in one glance rather than discovered later.
If something is missing it renders a page naming it instead of a blank 500, and
`/api/health` (behind the admin session) reports exactly what was found:

```json
{ "database": { "kind": "postgres", "configuredVia": "POSTGRES_URL", "reachable": true },
  "uploads": "blob", "ok": true }
```

**Environment variables only take effect on a new deployment** — after
connecting storage, redeploy.

### Anywhere with a real disk (Render, Fly, a VPS)

No Postgres or Blob needed. Mount a persistent disk and point `DB_PATH` and
`UPLOAD_DIR` inside it.

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
- **One storage interface, two backends.** `lib/store` defines what the app
  needs from persistence and implements it twice — SQLite for local work,
  Postgres for deployment. The same contract test suite runs against both, so a
  difference between them cannot become a production-only bug.
- **Misconfiguration fails loudly.** On a serverless host with no
  `DATABASE_URL`, the app throws instead of falling back to a database that
  will be deleted. Uploads with nowhere durable to go return a 501 that names
  the missing variable.
- **Uploads live outside `public/`.** Next only serves `public/` as it was at
  build time, so anything uploaded afterwards would 404 in production. Files go
  to `UPLOAD_DIR` and are streamed by `/uploads/[...path]`, which accepts only
  the UUID filenames this app generates.
- **Share links are unguessable.** `shravan-yadav-a4f9` — one client's link
  cannot be walked to another's, which matters when links get forwarded on
  WhatsApp. Client pages also send `noindex`.

## Tests

```bash
npm test              # 52 unit tests, incl. the store contract against both backends
npm run test:e2e      # 50 checks against a built server on SQLite
npm run test:e2e:pg   # the same 50 checks over the Postgres wire protocol
npm run test:browser  # 34 browser checks, two devices, Postgres
npm run test:all      # everything, with a build in between
```

- **Unit** — Indian lakh/crore wording, rupee formatting, percentage splits,
  input coercion, and a store contract suite run identically against SQLite and
  a real Postgres (PGlite in-process), because the app is developed on one and
  deployed on the other.
- **End-to-end** — boots `next start` and exercises access control, creating,
  the public render, editing, itemised pricing, share-link changes, uploads
  including path-traversal attempts, and delete. Runs against both backends;
  the Postgres run puts a real socket server in front of PGlite so the `pg`
  driver and the production SQL are genuinely used.
- **Deployment safety** (`scripts/e2e-serverless.mjs`) — simulates a serverless
  host and asserts that with no database the admin renders a page naming what
  to add, the API answers 503 rather than crashing, a client sees a calm
  message instead of setup instructions, and no SQLite file is written. Then
  connects Postgres through `POSTGRES_URL` alone — not `DATABASE_URL` — to
  prove the host integrations' variable names work, and checks that a missing
  Blob token disables uploads with a useful message while everything else keeps
  working.
- **Browser** (`scripts/e2e-browser.mjs`) — signs in, creates and edits a
  quotation, watches the live preview track the form, uploads a photograph,
  then opens the share link **in a separate browser context with no cookies**
  and checks that this second device sees exactly what the first one wrote,
  including after a later edit. Also covers the lightbox, the WhatsApp and call
  links, the phone-sized editor tabs, horizontal overflow, and asserts no
  JavaScript errors occurred.

```bash
npm run preview:shots -- ./shots
```

Seeds a realistic quotation and screenshots the client page (desktop, phone,
print) and the admin.
