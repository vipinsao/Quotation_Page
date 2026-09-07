import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

export const newId = customAlphabet(alphabet, 12);
export const newToken = customAlphabet(alphabet, 6);

/** "Mr. Shravan Yadav" -> "shravan-yadav". Empty-safe. */
export function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Public share slug. The random suffix keeps one client's quotation from being
 * guessable off another's — these links get forwarded around on WhatsApp.
 */
export function buildSlug(clientName: string): string {
  const base = slugifyName(clientName) || "quotation";
  return `${base}-${newToken()}`;
}
