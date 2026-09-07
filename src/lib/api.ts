import { NextResponse } from "next/server";
import { StorageNotConfiguredError } from "./store";

/**
 * Turns a storage failure into an answer the editor can show, rather than an
 * unhandled rejection the browser reports as "something went wrong".
 */
export function storageFailureResponse(error: unknown): NextResponse {
  if (error instanceof StorageNotConfiguredError) {
    return NextResponse.json({ error: error.message, setupRequired: true }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: `Could not reach the database: ${message}` }, { status: 503 });
}
