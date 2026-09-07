"use client";

import { useRef, useState } from "react";

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
  onUploaded,
}: {
  label: string;
  hint?: string;
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { upload, uploading, error } = useImageUpload();

  async function handle(files: FileList | File[] | null) {
    if (!files) return;
    const urls = await upload(files);
    if (urls.length > 0) onUploaded(urls);
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
