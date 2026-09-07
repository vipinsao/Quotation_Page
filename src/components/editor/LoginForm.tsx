"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setError(payload.error || "Could not sign in.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-white p-8 shadow-sm">
        <p className="eyebrow text-center">The Wedding Sridha</p>
        <h1 className="mt-3 text-center font-display text-2xl font-light text-forest">Quotation admin</h1>

        <label className="mt-8 block">
          <span className="mb-1.5 block text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
            Password
          </span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>

        {error && <p className="mt-3 text-[0.8rem] text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-md bg-forest py-2.5 text-sm font-medium text-cream transition hover:bg-forest-soft disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
