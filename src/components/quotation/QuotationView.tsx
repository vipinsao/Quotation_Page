import { clientDisplayName, coupleName, resolveAmountInWords, resolveMilestones, resolveTotal, whatsappLink } from "@/lib/compute";
import { formatINR } from "@/lib/money";
import type { Quotation } from "@/lib/types";
import { Gallery } from "./Gallery";
import { PrintButton } from "./PrintButton";
import { Check, Diamond, Paragraphs, Section } from "./primitives";

/* ------------------------------------------------------------------ Hero */

function Hero({ q }: { q: Quotation }) {
  const meta = [
    q.meta.quoteNumber && { label: "Quotation", value: q.meta.quoteNumber },
    q.meta.quoteDate && { label: "Date", value: q.meta.quoteDate },
    q.meta.validUntil && { label: "Valid until", value: q.meta.validUntil },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <header className="relative isolate overflow-hidden bg-forest text-cream print-exact">
      {q.studio.coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={q.studio.coverUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-ink/70" />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(130%_110%_at_50%_-10%,#356049_0%,#1e3a2b_45%,#12201a_100%)]"
        />
      )}

      <div
        data-hero
        className="mx-auto flex w-full max-w-4xl flex-col px-6 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg tracking-[0.18em] text-cream sm:text-xl">
              {q.studio.name.toUpperCase()}
            </p>
            {q.studio.tagline && (
              <p className="mt-1 text-[0.7rem] tracking-[0.16em] text-sage-pale/70 uppercase">
                {q.studio.tagline}
              </p>
            )}
          </div>
          <PrintButton
            className="no-print hidden shrink-0 rounded-full border border-cream/25 px-4 py-2 text-xs tracking-wide text-cream/80 transition hover:border-cream/50 hover:text-cream sm:block"
          />
        </div>

        <div data-hero-body className="mt-16 text-center sm:mt-24">
          <p className="eyebrow text-gold-pale">Quotation prepared for</p>
          <h1 className="mt-4 font-display text-[2.6rem] font-light leading-[1.05] text-cream sm:text-6xl">
            {coupleName(q) || clientDisplayName(q)}
          </h1>
          {q.event.title && (
            <p className="mt-5 text-sm tracking-[0.14em] uppercase text-sage-pale/85 sm:text-[0.8rem]">
              {q.event.title}
            </p>
          )}
          {(q.event.dates || q.event.venue) && (
            <p className="numerals mt-3 font-display text-lg text-cream/85 sm:text-xl">
              {[q.event.dates, q.event.venue].filter(Boolean).join("  ·  ")}
            </p>
          )}
        </div>

        {meta.length > 0 && (
          <dl className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-4 border-t border-cream/15 pt-6 text-center sm:mt-20">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-[0.65rem] tracking-[0.18em] uppercase text-sage-pale/60">{m.label}</dt>
                <dd className="mt-1 text-sm text-cream/90">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Letter */

function Letter({ q }: { q: Quotation }) {
  if (!q.letter.greeting && !q.letter.body) return null;
  return (
    <Section tone="cream" className="print-avoid-break">
      <div className="mx-auto max-w-[62ch] text-center">
        {q.letter.greeting && (
          <p className="font-display text-2xl text-forest sm:text-[1.75rem]">{q.letter.greeting}</p>
        )}
        <Paragraphs
          text={q.letter.body}
          className="mt-5 text-left text-[1.02rem] leading-[1.8] text-body/85"
        />
        <div className="rule mx-auto mt-10 max-w-xs">
          <Diamond className="text-gold" />
        </div>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- Gallery */

function Work({ q }: { q: Quotation }) {
  if (q.gallery.photos.length === 0) return null;
  return (
    <Section
      tone="paper"
      width="wide"
      eyebrow="Our work"
      title={q.gallery.title}
      lead={q.gallery.subtitle}
      className="border-y border-line"
    >
      <Gallery photos={q.gallery.photos} />
    </Section>
  );
}

/* -------------------------------------------------------------- Services */

function Services({ q }: { q: Quotation }) {
  if (q.services.groups.length === 0) return null;
  return (
    <Section tone="cream" eyebrow="Inclusions" title={q.services.title} lead={q.services.subtitle}>
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
        {q.services.groups.map((group) => (
          <div key={group.id} className="print-avoid-break">
            <h3 className="font-display text-xl text-forest">{group.title}</h3>
            <div className="mt-3 h-px w-12 bg-gold/50" />
            <ul className="mt-4 space-y-3">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-body/85">
                  <Diamond className="mt-[0.5rem] text-gold/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ Team */

function Team({ q }: { q: Quotation }) {
  if (q.team.members.length === 0) return null;
  return (
    <Section
      tone="paper"
      eyebrow="On the day"
      title={q.team.title}
      lead={q.team.subtitle}
      className="border-y border-line"
    >
      <ul className="grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-2">
        {q.team.members.map((member) => (
          <li key={member.id} className="flex items-center gap-4 bg-paper px-5 py-5 print-avoid-break">
            <span className="numerals w-7 shrink-0 text-center font-display text-[2rem] leading-none text-gold">
              {member.count}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-medium text-forest">{member.role}</span>
              {member.duration && (
                <span className="mt-0.5 block text-[0.8rem] text-muted">{member.duration}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------------------------------------------------- Deliverables */

function Deliverables({ q }: { q: Quotation }) {
  if (q.deliverables.items.length === 0 && !q.deliverables.timelineNote) return null;
  return (
    <Section tone="cream" eyebrow="Deliverables" title={q.deliverables.title} lead={q.deliverables.subtitle}>
      {q.deliverables.items.length > 0 && (
        <ul className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          {q.deliverables.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[0.95rem] leading-relaxed text-body/85 print-avoid-break">
              <Check className="mt-[0.15rem] text-forest-soft" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {q.deliverables.timelineNote && (
        <p className="mx-auto mt-10 max-w-2xl rounded-sm border border-sage-pale bg-sage-pale/40 px-5 py-4 text-center text-[0.9rem] text-forest print-exact">
          {q.deliverables.timelineNote}
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ Investment */

function Investment({ q }: { q: Quotation }) {
  const total = resolveTotal(q);
  const words = resolveAmountInWords(q);
  const milestones = resolveMilestones(q);
  const showItems = q.pricing.showLineItems && q.pricing.lineItems.length > 0;

  return (
    <Section tone="paper" eyebrow="Investment" title={q.pricing.title} className="border-y border-line print-break-before">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-sm border border-line bg-cream/60 print-exact print-avoid-break">
          {showItems && (
            <ul className="divide-y divide-line px-6 pt-2 sm:px-8">
              {q.pricing.lineItems.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-6 py-4">
                  <span className="min-w-0">
                    <span className="block text-[0.95rem] text-body">{item.label}</span>
                    {item.note && <span className="mt-0.5 block text-[0.8rem] text-muted">{item.note}</span>}
                  </span>
                  <span className="shrink-0 text-[0.95rem] tabular-nums text-body">{formatINR(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={`px-6 py-8 text-center sm:px-8 ${showItems ? "border-t border-line" : ""}`}>
            <p className="text-[0.7rem] tracking-[0.2em] uppercase text-muted">Total</p>
            <p className="numerals mt-2 font-display text-5xl font-light tracking-tight text-forest sm:text-6xl">
              {formatINR(total)}
            </p>
            {words && <p className="mt-3 font-display text-lg italic text-muted">{words}</p>}
            {q.pricing.note && (
              <p className="mx-auto mt-4 max-w-sm text-[0.85rem] leading-relaxed text-muted">{q.pricing.note}</p>
            )}
          </div>
        </div>

        {milestones.length > 0 && (
          <div className="mt-12 print-avoid-break">
            <h3 className="text-center font-display text-2xl text-forest">{q.payments.title}</h3>
            <ol className="mt-6 space-y-px overflow-hidden rounded-sm bg-line">
              {milestones.map((m, i) => (
                <li key={m.id} className="flex items-center gap-4 bg-paper px-5 py-4 sm:px-6">
                  <span className="numerals flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 font-display text-base text-gold print-exact">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] font-medium text-forest">
                      {m.label}
                      {m.percent > 0 && <span className="ml-2 text-[0.8rem] font-normal text-muted">{m.percent}%</span>}
                    </span>
                    {m.when && <span className="mt-0.5 block text-[0.8rem] text-muted">{m.when}</span>}
                  </span>
                  <span className="shrink-0 text-[0.95rem] tabular-nums text-forest">{formatINR(m.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- Terms */

function Terms({ q }: { q: Quotation }) {
  if (q.terms.items.length === 0) return null;
  return (
    <Section tone="cream" eyebrow="The details" title={q.terms.title}>
      <ol className="mx-auto grid max-w-2xl list-none gap-4 sm:grid-cols-2">
        {q.terms.items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[0.85rem] leading-relaxed text-muted print-avoid-break">
            <span className="numerals font-display text-base leading-tight text-gold">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* --------------------------------------------------------------- Signoff */

function Signoff({ q }: { q: Quotation }) {
  const wa = whatsappLink(
    q,
    `Hi ${q.signoff.personName || q.signoff.businessName}, I've read the quotation for ${coupleName(q) || "our wedding"}.`,
  );
  const tel = q.signoff.phone.replace(/[^0-9+]/g, "");

  return (
    <footer className="bg-forest text-cream print-exact">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center sm:px-8 sm:py-20">
        {q.signoff.message && (
          <p className="mx-auto max-w-[52ch] font-display text-xl leading-relaxed text-cream/90 sm:text-2xl">
            {q.signoff.message}
          </p>
        )}

        <div className="rule mx-auto mt-10 max-w-[10rem] text-cream/25">
          <Diamond className="text-gold-pale" />
        </div>

        <div className="mt-10">
          <p className="eyebrow text-gold-pale">Warm regards</p>
          {q.signoff.personName && (
            <p className="mt-3 font-display text-2xl text-cream">{q.signoff.personName}</p>
          )}
          {q.signoff.businessName && (
            <p className="mt-1 text-[0.75rem] tracking-[0.18em] uppercase text-sage-pale/70">
              {q.signoff.businessName}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-cream/80">
          {q.signoff.phone && <a href={`tel:${tel}`} className="hover:text-cream">{q.signoff.phone}</a>}
          {q.signoff.email && <a href={`mailto:${q.signoff.email}`} className="hover:text-cream">{q.signoff.email}</a>}
          {q.signoff.instagram && (
            <a
              href={`https://instagram.com/${q.signoff.instagram.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-cream"
            >
              @{q.signoff.instagram.replace(/^@/, "")}
            </a>
          )}
          {q.signoff.website && (
            <a href={q.signoff.website} target="_blank" rel="noreferrer" className="hover:text-cream">
              {q.signoff.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>

        <div className="no-print mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-full bg-gold-pale px-7 py-3 text-sm font-medium text-forest transition hover:bg-cream sm:w-auto"
            >
              Message us on WhatsApp
            </a>
          )}
          {tel && (
            <a
              href={`tel:${tel}`}
              className="w-full rounded-full border border-cream/30 px-7 py-3 text-sm text-cream transition hover:border-cream/60 sm:w-auto"
            >
              Call {q.signoff.phone}
            </a>
          )}
          <PrintButton
            label="Save as PDF"
            className="w-full rounded-full border border-cream/30 px-7 py-3 text-sm text-cream transition hover:border-cream/60 sm:w-auto"
          />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ View */

export function QuotationView({ quotation }: { quotation: Quotation }) {
  return (
    <article className="bg-cream">
      <Hero q={quotation} />
      <Letter q={quotation} />
      <Work q={quotation} />
      <Services q={quotation} />
      <Team q={quotation} />
      <Deliverables q={quotation} />
      <Investment q={quotation} />
      <Terms q={quotation} />
      <Signoff q={quotation} />
    </article>
  );
}
