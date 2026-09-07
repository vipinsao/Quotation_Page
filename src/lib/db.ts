import { getStore } from "./store";
import type { Quotation, QuotationSummary } from "./types";

export { storeKind, isServerless } from "./store";

export async function listQuotations(): Promise<QuotationSummary[]> {
  return (await getStore()).list();
}

export async function getQuotationById(id: string): Promise<Quotation | null> {
  return (await getStore()).getById(id);
}

export async function getQuotationBySlug(slug: string): Promise<Quotation | null> {
  return (await getStore()).getBySlug(slug);
}

export async function insertQuotation(quotation: Quotation): Promise<Quotation> {
  return (await getStore()).insert(quotation);
}

export async function updateQuotation(quotation: Quotation): Promise<Quotation> {
  return (await getStore()).update(quotation);
}

export async function deleteQuotation(id: string): Promise<boolean> {
  return (await getStore()).remove(id);
}

export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  return (await getStore()).slugExists(slug, exceptId);
}
