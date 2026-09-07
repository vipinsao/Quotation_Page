import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "wq_admin";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

/** With no ADMIN_PASSWORD set the studio runs it locally, unlocked. */
export function authDisabled(): boolean {
  return adminPassword() === "";
}

function expectedToken(): string {
  return createHash("sha256")
    .update(`${adminPassword()}::${process.env.AUTH_SALT || "the-wedding-sridha"}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string): boolean {
  return !authDisabled() && safeEqual(candidate, adminPassword());
}

export function sessionToken(): string {
  return expectedToken();
}

export async function isAuthenticated(): Promise<boolean> {
  if (authDisabled()) return true;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(token && safeEqual(token, expectedToken()));
}
