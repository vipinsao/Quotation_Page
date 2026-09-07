import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotationView } from "@/components/quotation/QuotationView";
import { coupleName } from "@/lib/compute";
import { getQuotationBySlug } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

// Quotations are edited constantly; never serve a cached copy to the client.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const quotation = await getQuotationBySlug(slug);
  if (!quotation) return { title: "Quotation not found" };

  const name = coupleName(quotation);
  return {
    title: `${quotation.studio.name} — Quotation for ${name}`,
    description: `${quotation.event.title} quotation prepared for ${name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ClientQuotationPage({ params }: Props) {
  const { slug } = await params;
  const quotation = await getQuotationBySlug(slug);
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
