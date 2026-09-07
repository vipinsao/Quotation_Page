"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryPhoto } from "@/lib/types";

export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + photos.length) % photos.length,
      ),
    [photos.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the lightbox.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [openIndex, close, step]);

  if (photos.length === 0) return null;

  const active = openIndex === null ? null : photos[openIndex];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {photos.map((photo, i) => (
          <li key={photo.id} className="print-avoid-break">
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative block w-full cursor-zoom-in overflow-hidden bg-sage-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
              aria-label={photo.caption || `Open photo ${i + 1}`}
            >
              <span className="block aspect-[4/5]">
                {/* Plain img: gallery URLs are arbitrary (uploads or pasted links). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || `Photograph ${i + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] print-exact"
                />
              </span>
              {photo.caption && (
                <span className="no-print pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pb-2 pt-8 text-left text-xs text-cream opacity-0 transition group-hover:opacity-100">
                  {photo.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption || "Photograph"}
          className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/95 p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-cream/70 transition hover:bg-white/10 hover:text-cream"
          >
            &times;
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl text-cream/70 transition hover:bg-white/10 hover:text-cream sm:left-6"
              >
                &#8249;
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl text-cream/70 transition hover:bg-white/10 hover:text-cream sm:right-6"
              >
                &#8250;
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.caption || "Photograph"}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full object-contain"
          />
          {active.caption && (
            <p className="mt-4 max-w-xl text-center text-sm text-cream/70">{active.caption}</p>
          )}
        </div>
      )}
    </>
  );
}
