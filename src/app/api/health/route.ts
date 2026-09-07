import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getStore, databaseUrlSource, isServerless, storeKind, DATABASE_ENV_VARS } from "@/lib/store";
import { uploadBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * One place to see what a deployment is actually configured with. Behind the
 * admin session, because it names the environment variables that are set.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let databaseReachable = false;
  let databaseError: string | null = null;
  try {
    await (await getStore()).list();
    databaseReachable = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json({
    serverless: isServerless(),
    database: {
      kind: storeKind(),
      configuredVia: databaseUrlSource(),
      accepts: DATABASE_ENV_VARS,
      reachable: databaseReachable,
      error: databaseError,
    },
    uploads: uploadBackend(),
    ok: databaseReachable,
  });
}
