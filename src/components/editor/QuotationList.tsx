"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@/lib/money";
import type { Quotation, QuotationSummary, QuotationStatus } from "@/lib/types";

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "border-line bg-cream text-muted",
  sent: "border-gold/40 bg-gold/10 text-gold",
  accepted: "border-forest/25 bg-sage-pale/50 text-forest",
};

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
};

export type StorageStatus = {
  database: "sqlite" | "postgres";
  uploads: "blob" | "disk" | "unavailable";
};

export function QuotationList({
  initial,
  unlocked,
  storage,
}: {
  initial: QuotationSummary[];
  unlocked: boolean;
  storage: StorageStatus;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  async function create(source?: unknown, clientName?: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: clientName ?? name, source }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        quotation?: Quotation;
        error?: string;
      };
      if (!response.ok || !payload.quotation) throw new Error(payload.error || "Could not create.");
      router.push(`/admin/${payload.quotation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create.");
      setBusy(false);
    }
  }

  async function duplicate(id: string) {
    setBusy(true);
    const response = await fetch(`/api/quotations/${id}`);
    const payload = (await response.json().catch(() => ({}))) as { quotation?: Quotation };
    if (!payload.quotation) {
      setError("Could not load that quotation.");
      setBusy(false);
      return;
    }
    await create(payload.quotation, `${payload.quotation.client.name} (copy)`);
  }

  async function remove(row: QuotationSummary) {
    if (!confirm(`Delete the quotation for ${row.clientName || "this client"}? This cannot be undone.`)) return;
    const response = await fetch(`/api/quotations/${row.id}`, { method: "DELETE" });
    if (response.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
    else setError("Could not delete that quotation.");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="mt-2 font-display text-3xl font-light text-forest sm:text-4xl">Quotations</h1>
          </div>
          {!unlocked && (
            <button type="button" onClick={signOut} className="text-[0.8rem] text-muted transition hover:text-forest">
              Sign out
            </button>
          )}
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="mt-8 flex flex-col gap-3 rounded-lg border border-line bg-white p-5 shadow-sm sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
              New quotation for
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-md bg-forest px-5 py-2.5 text-sm font-medium text-cream transition hover:bg-forest-soft disabled:opacity-60"
          >
            {busy ? "Working…" : "Create"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-4 space-y-2">
          {unlocked && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[0.8rem] text-amber-900">
              No admin password is set. Fine on your own machine — set <code>ADMIN_PASSWORD</code> in
              your environment before putting this online.
            </p>
          )}

          {storage.uploads === "unavailable" && (
            <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-[0.8rem] text-red-900">
              Photo uploads are turned off: this deployment has no file storage. Add a Vercel Blob
              store so <code>BLOB_READ_WRITE_TOKEN</code> is set. Until then you can still paste
              image URLs into a quotation.
            </p>
          )}

          <p className="text-[0.75rem] text-muted">
            {storage.database === "postgres"
              ? "Quotations are stored in Postgres"
              : "Quotations are stored in a local SQLite file"}
            {" · "}
            {storage.uploads === "blob"
              ? "photos in Vercel Blob"
              : storage.uploads === "disk"
                ? "photos on local disk"
                : "photo uploads unavailable"}
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {rows.length === 0 && (
            <li className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
              No quotations yet. Create your first one above — it starts from your house template.
            </li>
          )}

          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-line bg-white p-4 shadow-sm transition hover:border-gold/50 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/${row.id}`} className="font-display text-xl text-forest hover:text-gold">
                    {row.clientName || "Untitled"}
                  </Link>
                  <p className="mt-0.5 truncate text-[0.8rem] text-muted">{row.eventTitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-sm text-forest">{formatINR(row.total)}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] ${STATUS_STYLES[row.status]}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[0.8rem]">
                <Link href={`/admin/${row.id}`} className="font-medium text-forest hover:text-gold">Edit</Link>
                <a href={`/q/${row.slug}`} target="_blank" rel="noreferrer" className="text-muted hover:text-forest">Client view</a>
                <button type="button" onClick={() => void duplicate(row.id)} className="text-muted hover:text-forest">Duplicate</button>
                <button type="button" onClick={() => void remove(row)} className="text-muted hover:text-red-600">Delete</button>
                <span className="ml-auto text-muted">
                  Updated {new Date(row.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
