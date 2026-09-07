"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/fields";
import { imageUrlWarning, normalizeImageUrl } from "@/lib/images";

/**
 * Uploads to /api/upload, or accepts a pasted URL. Photographers already have
 * their work on Pixieset/Drive/Instagram, so both paths need to work.
 */
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | File[]): Promise<string[]> {
    const list = Array.from(files);
    if (list.length === 0) return [];

    setUploading(true);
    setError("");
    const urls: string[] = [];

    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!response.ok || !payload.url) {
          setError(payload.error || `Could not upload ${file.name}.`);
          continue;
        }
        urls.push(payload.url);
      }
    } finally {
      setUploading(false);
    }

    return urls;
  }

  return { upload, uploading, error, setError };
}

export function ImageDropZone({
  label,
  hint,
  multiple = true,
  enabled = true,
  onUploaded,
}: {
  label: string;
  hint?: string;
  multiple?: boolean;
  /** False on a deployment with no file storage — say so rather than fail on click. */
  enabled?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { upload, uploading, error } = useImageUpload();

  async function handle(files: FileList | File[] | null) {
    if (!files || !enabled) return;
    const urls = await upload(files);
    if (urls.length > 0) onUploaded(urls);
  }

  if (!enabled) {
    return (
      <div className="rounded-md border border-dashed border-line bg-cream/40 px-4 py-5 text-center">
        <p className="text-sm text-muted">Uploading files isn&rsquo;t available on this deployment</p>
        <p className="mx-auto mt-1 max-w-sm text-[0.75rem] leading-relaxed text-muted">
          Connect a Vercel Blob store and redeploy to turn it on. In the meantime, paste the
          image&rsquo;s web address in the field below — it works exactly the same for the client.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files);
        }}
        className={`rounded-md border border-dashed px-4 py-6 text-center transition ${
          dragging ? "border-gold bg-gold/5" : "border-line bg-cream/40"
        }`}
      >
        <p className="text-sm text-body">{label}</p>
        {hint && <p className="mt-1 text-[0.75rem] text-muted">{hint}</p>}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-full border border-line bg-white px-4 py-1.5 text-xs font-medium text-forest transition hover:border-gold disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Choose image" + (multiple ? "s" : "")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-2 text-[0.75rem] text-red-600">{error}</p>}
    </div>
  );
}

type UrlState = "empty" | "loading" | "ok" | "failed";

/**
 * A URL field that proves itself. Without the thumbnail there is no way to tell
 * a working link from a share page that renders nothing, which makes a correct
 * feature look broken.
 */
export function ImageUrlField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [state, setState] = useState<UrlState>(value ? "loading" : "empty");
  const warning = imageUrlWarning(value);

  useEffect(() => {
    setState(value.trim() ? "loading" : "empty");
  }, [value]);

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-line bg-sage-pale/40">
          {value.trim() && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={value}
              src={value}
              alt=""
              onLoad={() => setState("ok")}
              onError={() => setState("failed")}
              className={`h-full w-full object-cover transition ${state === "ok" ? "opacity-100" : "opacity-0"}`}
            />
          )}
          {state !== "ok" && (
            <span className="absolute inset-0 flex items-center justify-center text-center text-[0.6rem] leading-tight text-muted">
              {state === "empty" ? "no image" : state === "loading" ? "…" : "can't load"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={value}
            placeholder="https://…"
            // Share links point at a viewer page; convert the ones we recognise
            // as the studio pastes them, so the field shows what will be used.
            onChange={(e) => onChange(normalizeImageUrl(e.target.value))}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-body shadow-sm outline-none transition placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {warning ? (
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-amber-700">{warning}</p>
          ) : state === "failed" ? (
            <p className="mt-1.5 text-[0.75rem] leading-relaxed text-red-600">
              This address didn&rsquo;t load as an image. It usually means the link points at a page
              rather than the photo itself.
            </p>
          ) : state === "ok" ? (
            <p className="mt-1.5 text-[0.75rem] text-forest">Image loads.</p>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
