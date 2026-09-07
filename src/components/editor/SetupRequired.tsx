/**
 * Shown instead of a bare 500 when the deployment has nowhere to store
 * quotations. A generic error page leaves you guessing; this names the exact
 * thing that is missing and where to add it.
 */
export function SetupRequired({
  detail,
  checked,
}: {
  detail: string;
  checked: readonly string[];
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="eyebrow">Setup required</p>
        <h1 className="mt-3 font-display text-3xl font-light text-forest sm:text-4xl">
          This deployment has no database yet
        </h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-body/85">
          The app is running, but there is nowhere durable to keep quotations. It is refusing to
          start rather than writing to a disk that disappears between requests — which would lose
          every quotation without warning.
        </p>

        <ol className="mt-8 space-y-4">
          {[
            {
              title: "Connect a Postgres database",
              body: "In your Vercel project: Storage → create or connect a Neon Postgres database. There is no migration step; the table is created on first use.",
            },
            {
              title: "Connect a Blob store",
              body: "Storage → create a Blob store. Without it quotations still work, but photo uploads stay disabled and you paste image URLs instead.",
            },
            {
              title: "Redeploy",
              body: "Environment variables are only picked up by a new deployment. Deployments → ⋯ → Redeploy.",
            },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="numerals flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 font-display text-base text-gold">
                {i + 1}
              </span>
              <span>
                <span className="block text-[0.95rem] font-medium text-forest">{step.title}</span>
                <span className="mt-1 block text-[0.85rem] leading-relaxed text-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-md border border-line bg-white p-5">
          <p className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
            What the server reported
          </p>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-body/85">{detail}</p>
          {checked.length > 0 && (
            <>
              <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
                Preferred names — but any variable holding a postgres:// URL is used
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {checked.map((name) => (
                  <li key={name} className="rounded border border-line bg-cream px-2 py-1 font-mono text-[0.72rem] text-muted">
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
