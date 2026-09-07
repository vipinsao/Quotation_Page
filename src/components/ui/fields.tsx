"use client";

import type { ReactNode } from "react";

const inputBase =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-body shadow-sm outline-none transition placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/20";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[0.75rem] leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  suffix,
  min = 0,
  className = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  suffix?: string;
  min?: number;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        <input
          type="number"
          min={min}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={`${inputBase} ${suffix ? "pr-10" : ""} tabular-nums`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 4,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} resize-y leading-relaxed`}
      />
    </Field>
  );
}

/**
 * Bullet lists are typed as plain lines rather than clicked in one at a time —
 * far faster when adapting a quotation for the next client.
 */
export function LinesField({
  label,
  items,
  onChange,
  placeholder,
  hint = "One per line.",
  rows = 5,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <TextAreaField
      label={label}
      hint={hint}
      rows={rows}
      placeholder={placeholder}
      value={items.join("\n")}
      onChange={(value) => onChange(value.split("\n").map((l) => l.trim()).filter(Boolean))}
    />
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-forest" : "bg-line"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? "translate-x-4" : ""}`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-body">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.75rem] text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5">
        <h2 className="font-display text-xl text-forest">{title}</h2>
        {description && <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">{description}</p>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
  );
}
