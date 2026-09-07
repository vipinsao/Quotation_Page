import type { ReactNode } from "react";

/**
 * Every section shares one rhythm: eyebrow, serif heading, optional lead,
 * then content. Keeping it in one place is what stops the page feeling busy.
 */
export function Section({
  eyebrow,
  title,
  lead,
  children,
  tone = "cream",
  width = "prose",
  className = "",
  id,
}: {
  eyebrow?: string;
  title?: string;
  lead?: string;
  children: ReactNode;
  tone?: "cream" | "paper" | "forest";
  /** Photographs earn more width than text does. */
  width?: "prose" | "wide";
  className?: string;
  id?: string;
}) {
  const tones = {
    cream: "bg-cream text-body",
    paper: "bg-paper text-body",
    forest: "bg-forest text-cream print-exact",
  } as const;

  return (
    <section id={id} className={`${tones[tone]} ${className}`}>
      <div
        data-section
        className={`mx-auto w-full px-6 py-14 sm:px-8 sm:py-20 ${
          width === "wide" ? "max-w-6xl" : "max-w-4xl"
        }`}
      >
        {(eyebrow || title || lead) && (
          <header className="print-avoid-break mb-10 text-center sm:mb-12">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h2
                className={`mt-3 font-display text-3xl font-light tracking-tight sm:text-4xl ${
                  tone === "forest" ? "text-cream" : "text-forest"
                }`}
              >
                {title}
              </h2>
            )}
            {lead && (
              <p
                className={`mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed ${
                  tone === "forest" ? "text-sage-pale/80" : "text-muted"
                }`}
              >
                {lead}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

/** Small diamond bullet — reads as a mark of care rather than a list dash. */
export function Diamond({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden className={`h-2 w-2 shrink-0 ${className}`}>
      <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="currentColor" />
    </svg>
  );
}

export function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`h-[1.15rem] w-[1.15rem] shrink-0 ${className}`}>
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path
        d="M6 10.2 L8.8 13 L14 7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Splits a textarea value into paragraphs so the letter reads like a letter. */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <div className={`quote-body ${className}`}>
      {blocks.map((block, i) => (
        <p key={i}>
          {block.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
