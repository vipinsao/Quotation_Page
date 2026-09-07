export default function QuotationNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="max-w-sm text-center">
        <p className="eyebrow">Quotation</p>
        <h1 className="mt-3 font-display text-3xl font-light text-forest">This link isn&rsquo;t active</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The quotation may have been moved or replaced. Please ask your photographer for an updated link.
        </p>
      </div>
    </main>
  );
}
