import { NextResponse } from "next/server";
import { ADMIN_COOKIE, authDisabled, checkPassword, sessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  if (authDisabled()) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
