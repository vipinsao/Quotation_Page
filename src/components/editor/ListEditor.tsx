"use client";

import type { ReactNode } from "react";

type Identified = { id: string };

/**
 * Reorderable repeating rows. Used for the crew, price lines, payment
 * milestones and service groups — anything with more than one field per row.
 */
export function ListEditor<T extends Identified>({
  items,
  onChange,
  create,
  addLabel,
  emptyLabel = "Nothing added yet.",
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
  emptyLabel?: string;
  renderItem: (item: T, patch: (changes: Partial<T>) => void, index: number) => ReactNode;
}) {
  const patchAt = (index: number) => (changes: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-[0.8rem] text-muted">
          {emptyLabel}
        </p>
      )}

      {items.map((item, index) => (
        <div key={item.id} className="rounded-md border border-line bg-cream/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[0.7rem] font-semibold tracking-[0.1em] uppercase text-muted">
              {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                &uarr;
              </IconButton>
              <IconButton
                label="Move down"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                &darr;
              </IconButton>
              <IconButton label="Remove" danger onClick={() => remove(index)}>
                &times;
              </IconButton>
            </div>
          </div>
          {renderItem(item, patchAt(index), index)}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, create()])}
        className="w-full rounded-md border border-dashed border-gold/50 px-4 py-2.5 text-sm font-medium text-gold transition hover:border-gold hover:bg-gold/5"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded border border-line bg-white text-sm transition disabled:cursor-not-allowed disabled:opacity-35 ${
        danger ? "text-red-600 hover:border-red-300 hover:bg-red-50" : "text-muted hover:border-gold hover:text-forest"
      }`}
    >
      {children}
    </button>
  );
}
