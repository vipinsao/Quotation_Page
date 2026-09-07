import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Which commit is actually serving. Public and deliberately tiny: the one
 * question worth asking after every push is "is my change live yet?", and
 * every other signal in this app sits behind the admin session.
 *
 * A commit hash on its own reveals nothing — no configuration, no data, no
 * variable names. Anything diagnostic belongs in /api/health, which is gated.
 */
export function GET() {
  return NextResponse.json(
    {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "local",
      environment: process.env.VERCEL_ENV || "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
