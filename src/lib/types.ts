export type QuotationStatus = "draft" | "sent" | "accepted";

/** A named group of services, e.g. "Videography Services" with its bullet list. */
export type ServiceGroup = {
  id: string;
  title: string;
  items: string[];
};

/** One crew line: "1 Candid Photographer — two days". */
export type TeamMember = {
  id: string;
  count: number;
  role: string;
  duration: string;
};

export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string;
};

/** Optional itemised pricing. When hidden, only the total is shown. */
export type LineItem = {
  id: string;
  label: string;
  note: string;
  amount: number;
};

export type PaymentMilestone = {
  id: string;
  label: string;
  percent: number;
  when: string;
};

export type Quotation = {
  id: string;
  slug: string;
  status: QuotationStatus;

  studio: {
    name: string;
    tagline: string;
    /** Optional cover photo behind the hero. Falls back to the botanical gradient. */
    coverUrl: string;
  };

  client: {
    salutation: string;
    name: string;
    partnerName: string;
    phone: string;
    email: string;
  };

  event: {
    title: string;
    dates: string;
    venue: string;
  };

  meta: {
    quoteNumber: string;
    quoteDate: string;
    validUntil: string;
  };

  letter: {
    greeting: string;
    body: string;
  };

  gallery: {
    title: string;
    subtitle: string;
    photos: GalleryPhoto[];
  };

  services: {
    title: string;
    subtitle: string;
    groups: ServiceGroup[];
  };

  team: {
    title: string;
    subtitle: string;
    members: TeamMember[];
  };

  deliverables: {
    title: string;
    subtitle: string;
    items: string[];
    timelineNote: string;
  };

  pricing: {
    title: string;
    showLineItems: boolean;
    lineItems: LineItem[];
    total: number;
    /** Leave blank to auto-generate Indian-format words from the total. */
    amountInWordsOverride: string;
    note: string;
  };

  payments: {
    title: string;
    milestones: PaymentMilestone[];
  };

  terms: {
    title: string;
    items: string[];
  };

  signoff: {
    message: string;
    personName: string;
    businessName: string;
    phone: string;
    email: string;
    whatsapp: string;
    instagram: string;
    website: string;
  };
};

/** Row shape returned by the admin list view. */
export type QuotationSummary = {
  id: string;
  slug: string;
  status: QuotationStatus;
  clientName: string;
  eventTitle: string;
  total: number;
  updatedAt: string;
  createdAt: string;
};
