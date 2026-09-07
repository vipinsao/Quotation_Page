import type { PostgresClient } from "@/lib/store/postgres";

/**
 * Photographs stored in Postgres.
 *
 * Not the first choice — object storage is — but it means the upload button
 * works on any deployment that already has a database, without the studio
 * having to wire up a second service or find somewhere to host images. A
 * quotation carries a handful of web-sized photographs, which is well within
 * what a small Postgres instance should hold.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS uploads (
     id           TEXT PRIMARY KEY,
     content_type TEXT NOT NULL,
     bytes        BYTEA NOT NULL,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

let ensured = false;

async function ensureSchema(client: PostgresClient) {
  if (ensured) return;
  for (const statement of SCHEMA) await client.query(statement);
  ensured = true;
}

export async function saveFile(
  client: PostgresClient,
  id: string,
  contentType: string,
  bytes: Buffer,
): Promise<void> {
  await ensureSchema(client);
  await client.query(
    `INSERT INTO uploads (id, content_type, bytes) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes`,
    [id, contentType, bytes],
  );
}

export async function readFile(
  client: PostgresClient,
  id: string,
): Promise<{ contentType: string; bytes: Buffer } | null> {
  await ensureSchema(client);
  const { rows } = await client.query(
    "SELECT content_type, bytes FROM uploads WHERE id = $1",
    [id],
  );
  const row = rows[0] as { content_type: string; bytes: Buffer | Uint8Array } | undefined;
  if (!row) return null;
  return { contentType: row.content_type, bytes: Buffer.from(row.bytes) };
}

export async function deleteFile(client: PostgresClient, id: string): Promise<boolean> {
  await ensureSchema(client);
  const { rows } = await client.query("DELETE FROM uploads WHERE id = $1 RETURNING id", [id]);
  return rows.length > 0;
}
