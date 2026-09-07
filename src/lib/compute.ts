import { numberToIndianWords, splitByPercent, sumLineItems } from "./money";
import type { Quotation } from "./types";

/**
 * When itemised pricing is switched on the line items are the source of truth,
 * so the headline figure can never drift from the rows above it.
 */
export function resolveTotal(q: Quotation): number {
  if (q.pricing.showLineItems && q.pricing.lineItems.length > 0) {
    return sumLineItems(q.pricing.lineItems);
  }
  return q.pricing.total;
}

export function resolveAmountInWords(q: Quotation): string {
  const override = q.pricing.amountInWordsOverride.trim();
  return override || numberToIndianWords(resolveTotal(q));
}

export type ResolvedMilestone = {
  id: string;
  label: string;
  percent: number;
  when: string;
  amount: number;
};

export function resolveMilestones(q: Quotation): ResolvedMilestone[] {
  const total = resolveTotal(q);
  const amounts = splitByPercent(total, q.payments.milestones.map((m) => m.percent));
  return q.payments.milestones.map((m, i) => ({ ...m, amount: amounts[i] ?? 0 }));
}

/** "Mr. Shravan Yadav" — salutation is optional and never doubles up a space. */
export function clientDisplayName(q: Quotation): string {
  return [q.client.salutation, q.client.name].map((s) => s.trim()).filter(Boolean).join(" ");
}

/** "Shravan & Priya" when a partner is named, otherwise just the client. */
export function coupleName(q: Quotation): string {
  const a = q.client.name.trim();
  const b = q.client.partnerName.trim();
  return b ? `${a} & ${b}` : a;
}

export function whatsappLink(q: Quotation, message: string): string {
  const number = q.signoff.whatsapp.replace(/[^0-9]/g, "");
  if (!number) return "";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
