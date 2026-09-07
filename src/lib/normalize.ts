import { blankQuotation } from "./defaults";
import { newId, slugifyName, buildSlug } from "./id";
import type {
  GalleryPhoto,
  LineItem,
  PaymentMilestone,
  Quotation,
  QuotationStatus,
  ServiceGroup,
  TeamMember,
} from "./types";

type Raw = Record<string, unknown>;

const asRaw = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // Tolerates "60,000" and "₹60,000" typed straight into the editor.
    const cleaned = v.replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Text lists drop blank rows so an empty editor field never renders a stray bullet. */
function strList(v: unknown): string[] {
  return asArray(v).map((item) => str(item)).filter(Boolean);
}

const STATUSES: QuotationStatus[] = ["draft", "sent", "accepted"];

function status(v: unknown): QuotationStatus {
  return STATUSES.includes(v as QuotationStatus) ? (v as QuotationStatus) : "draft";
}

/** Public slugs must stay URL-safe even if someone edits one by hand. */
export function sanitizeSlug(v: unknown, clientName: string): string {
  const cleaned = slugifyName(str(v));
  return cleaned || buildSlug(clientName);
}

function serviceGroups(v: unknown): ServiceGroup[] {
  return asArray(v)
    .map((entry) => {
      const g = asRaw(entry);
      return { id: str(g.id) || newId(), title: str(g.title), items: strList(g.items) };
    })
    .filter((g) => g.title || g.items.length > 0);
}

function teamMembers(v: unknown): TeamMember[] {
  return asArray(v)
    .map((entry) => {
      const m = asRaw(entry);
      return {
        id: str(m.id) || newId(),
        count: Math.max(0, Math.round(num(m.count, 1))),
        role: str(m.role),
        duration: str(m.duration),
      };
    })
    .filter((m) => m.role);
}

function photos(v: unknown): GalleryPhoto[] {
  return asArray(v)
    .map((entry) => {
      const p = asRaw(entry);
      return { id: str(p.id) || newId(), url: str(p.url), caption: str(p.caption) };
    })
    .filter((p) => p.url);
}

function lineItems(v: unknown): LineItem[] {
  return asArray(v)
    .map((entry) => {
      const l = asRaw(entry);
      return { id: str(l.id) || newId(), label: str(l.label), note: str(l.note), amount: num(l.amount) };
    })
    .filter((l) => l.label);
}

function milestones(v: unknown): PaymentMilestone[] {
  return asArray(v)
    .map((entry) => {
      const m = asRaw(entry);
      return {
        id: str(m.id) || newId(),
        label: str(m.label),
        percent: num(m.percent),
        when: str(m.when),
      };
    })
    .filter((m) => m.label);
}

/**
 * Coerces anything the client sends into a complete, renderable Quotation.
 * The view layer can then assume every field exists.
 */
export function normalizeQuotation(input: unknown, existing?: Quotation): Quotation {
  const base = existing ?? blankQuotation();
  const raw = asRaw(input);

  const studio = asRaw(raw.studio);
  const client = asRaw(raw.client);
  const event = asRaw(raw.event);
  const meta = asRaw(raw.meta);
  const letter = asRaw(raw.letter);
  const gallery = asRaw(raw.gallery);
  const services = asRaw(raw.services);
  const team = asRaw(raw.team);
  const deliverables = asRaw(raw.deliverables);
  const pricing = asRaw(raw.pricing);
  const payments = asRaw(raw.payments);
  const terms = asRaw(raw.terms);
  const signoff = asRaw(raw.signoff);

  const clientName = str(client.name, base.client.name);

  const nextLineItems = "lineItems" in pricing ? lineItems(pricing.lineItems) : base.pricing.lineItems;

  return {
    // id and slug are owned by the server, never taken from the request body.
    id: base.id,
    slug: base.slug,
    status: status(raw.status ?? base.status),

    studio: {
      name: str(studio.name, base.studio.name),
      tagline: str(studio.tagline, base.studio.tagline),
      coverUrl: str(studio.coverUrl, base.studio.coverUrl),
    },

    client: {
      salutation: str(client.salutation, base.client.salutation),
      name: clientName,
      partnerName: str(client.partnerName, base.client.partnerName),
      phone: str(client.phone, base.client.phone),
      email: str(client.email, base.client.email),
    },

    event: {
      title: str(event.title, base.event.title),
      dates: str(event.dates, base.event.dates),
      venue: str(event.venue, base.event.venue),
    },

    meta: {
      quoteNumber: str(meta.quoteNumber, base.meta.quoteNumber),
      quoteDate: str(meta.quoteDate, base.meta.quoteDate),
      validUntil: str(meta.validUntil, base.meta.validUntil),
    },

    letter: {
      greeting: str(letter.greeting, base.letter.greeting),
      body: str(letter.body, base.letter.body),
    },

    gallery: {
      title: str(gallery.title, base.gallery.title),
      subtitle: str(gallery.subtitle, base.gallery.subtitle),
      photos: "photos" in gallery ? photos(gallery.photos) : base.gallery.photos,
    },

    services: {
      title: str(services.title, base.services.title),
      subtitle: str(services.subtitle, base.services.subtitle),
      groups: "groups" in services ? serviceGroups(services.groups) : base.services.groups,
    },

    team: {
      title: str(team.title, base.team.title),
      subtitle: str(team.subtitle, base.team.subtitle),
      members: "members" in team ? teamMembers(team.members) : base.team.members,
    },

    deliverables: {
      title: str(deliverables.title, base.deliverables.title),
      subtitle: str(deliverables.subtitle, base.deliverables.subtitle),
      items: "items" in deliverables ? strList(deliverables.items) : base.deliverables.items,
      timelineNote: str(deliverables.timelineNote, base.deliverables.timelineNote),
    },

    pricing: {
      title: str(pricing.title, base.pricing.title),
      showLineItems: bool(pricing.showLineItems, base.pricing.showLineItems),
      lineItems: nextLineItems,
      total: num(pricing.total, base.pricing.total),
      amountInWordsOverride: str(pricing.amountInWordsOverride, base.pricing.amountInWordsOverride),
      note: str(pricing.note, base.pricing.note),
    },

    payments: {
      title: str(payments.title, base.payments.title),
      milestones: "milestones" in payments ? milestones(payments.milestones) : base.payments.milestones,
    },

    terms: {
      title: str(terms.title, base.terms.title),
      items: "items" in terms ? strList(terms.items) : base.terms.items,
    },

    signoff: {
      message: str(signoff.message, base.signoff.message),
      personName: str(signoff.personName, base.signoff.personName),
      businessName: str(signoff.businessName, base.signoff.businessName),
      phone: str(signoff.phone, base.signoff.phone),
      email: str(signoff.email, base.signoff.email),
      whatsapp: str(signoff.whatsapp, base.signoff.whatsapp),
      instagram: str(signoff.instagram, base.signoff.instagram),
      website: str(signoff.website, base.signoff.website),
    },
  };
}
