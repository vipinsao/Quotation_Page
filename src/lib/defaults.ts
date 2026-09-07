import { newId, buildSlug } from "./id";
import type { Quotation } from "./types";

/**
 * The studio's house template, seeded from the existing PDF quotation.
 * Every new quotation starts here and is then edited per client.
 */
export function blankQuotation(overrides: { clientName?: string } = {}): Quotation {
  const clientName = overrides.clientName?.trim() || "New Client";

  return {
    id: newId(),
    slug: buildSlug(clientName),
    status: "draft",

    studio: {
      name: "The Wedding Sridha",
      tagline: "Wedding Photography & Cinematography",
      coverUrl: "",
      coverOverlay: 45,
    },

    client: {
      salutation: "Mr.",
      name: clientName,
      partnerName: "",
      phone: "",
      email: "",
    },

    event: {
      title: "Wedding Photography & Videography",
      dates: "",
      venue: "",
    },

    meta: {
      quoteNumber: "",
      quoteDate: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      validUntil: "",
    },

    letter: {
      greeting: `Dear ${clientName.split(" ")[0] || "there"},`,
      body:
        "Thank you for considering us to capture your special day. We are delighted to present our quotation for your wedding photography and videography services.",
    },

    gallery: {
      title: "A Little Of Our Work",
      subtitle: "Moments we have had the privilege of photographing.",
      photos: [],
    },

    services: {
      title: "What's Included",
      subtitle: "Everything covered under this quotation.",
      groups: [
        {
          id: newId(),
          title: "Videography",
          items: [
            "Traditional full wedding video — complete ceremony coverage",
            "Cinematic wedding highlight video",
          ],
        },
        {
          id: newId(),
          title: "Photography",
          items: [
            "Premium photo album — high-quality prints with elegant binding",
            "Complete photography coverage across all events",
            "Professional editing and colour correction",
          ],
        },
      ],
    },

    team: {
      title: "Your Team",
      subtitle: "The people who will be with you on the day.",
      members: [
        { id: newId(), count: 1, role: "Traditional Photographer", duration: "3 days" },
        { id: newId(), count: 1, role: "Candid Photographer", duration: "2 days" },
        { id: newId(), count: 1, role: "Traditional Videographer", duration: "3 days" },
        { id: newId(), count: 1, role: "Drone Pilot", duration: "1 day" },
      ],
    },

    deliverables: {
      title: "What You Receive",
      subtitle: "",
      items: [
        "1 traditional full-length wedding video",
        "1 cinematic wedding highlight video",
        "1 premium wedding photo album (35 sheets)",
        "High-resolution digital copies of all photos and videos",
        "Online gallery access to share with family and friends",
      ],
      timelineNote: "Delivered within 45–60 days of the wedding date.",
    },

    pricing: {
      title: "Your Investment",
      showLineItems: false,
      lineItems: [],
      total: 60000,
      amountInWordsOverride: "",
      note: "All-inclusive for the coverage listed above.",
    },

    payments: {
      title: "Payment Schedule",
      milestones: [
        { id: newId(), label: "Booking amount", percent: 30, when: "To confirm the dates" },
        { id: newId(), label: "Second payment", percent: 40, when: "Before the wedding day" },
        { id: newId(), label: "Final payment", percent: 30, when: "On delivery of the final edited content" },
      ],
    },

    terms: {
      title: "Terms & Conditions",
      items: [
        "All deliverables will be provided within 45–60 days from the wedding date.",
        "Raw footage and photos will be provided.",
        "Any additional requirements will be charged separately.",
      ],
    },

    signoff: {
      message: "For any queries or changes to this quotation, please feel free to reach out. We would love to be part of your day.",
      personName: "Takeshwar Dewangan",
      businessName: "The Wedding Sridha",
      phone: "8109705662",
      email: "theweddingsridha@gmail.com",
      whatsapp: "918109705662",
      instagram: "",
      website: "",
    },
  };
}
