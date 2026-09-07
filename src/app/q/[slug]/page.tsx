import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotationView } from "@/components/quotation/QuotationView";
import { coupleName } from "@/lib/compute";
import { getQuotationBySlug } from "@/lib/db";
import type { Quotation } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

// Quotations are edited constantly; never serve a cached copy to the client.
export const dynamic = "force-dynamic";

/** Distinguishes "no such quotation" from "we cannot reach the database". */
async function load(slug: string): Promise<{ quotation: Quotation | null; unavailable: boolean }> {
  try {
    return { quotation: await getQuotationBySlug(slug), unavailable: false };
  } catch {
    return { quotation: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { quotation } = await load(slug);
  if (!quotation) return { title: "Quotation", robots: { index: false, follow: false } };

  const name = coupleName(quotation);
  return {
    title: `${quotation.studio.name} — Quotation for ${name}`,
    description: `${quotation.event.title} quotation prepared for ${name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ClientQuotationPage({ params }: Props) {
  const { slug } = await params;
  const { quotation, unavailable } = await load(slug);

  // A client should never be shown a stack trace or setup instructions — their
  // link is probably fine, the studio's deployment is not.
  if (unavailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="max-w-sm text-center">
          <p className="eyebrow">Quotation</p>
          <h1 className="mt-3 font-display text-3xl font-light text-forest">
            Just a moment
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            We can&rsquo;t load this quotation right now. Please try again shortly, or ask your
            photographer to resend the link.
          </p>
        </div>
      </main>
    );
  }

  if (!quotation) notFound();

  return (
    <main>
      {quotation.status === "draft" && (
        <p className="no-print bg-gold/15 px-4 py-2 text-center text-xs tracking-wide text-forest">
          Draft — this quotation has not been marked as sent yet.
        </p>
      )}
      <QuotationView quotation={quotation} />
    </main>
  );
}
