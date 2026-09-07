import { describe, expect, it } from "vitest";
import { blankQuotation } from "@/lib/defaults";
import { normalizeQuotation } from "@/lib/normalize";

describe("normalizeQuotation", () => {
  it("produces a complete quotation from an empty object", () => {
    const q = normalizeQuotation({});
    expect(q.studio.name).toBeTruthy();
    expect(q.pricing.total).toBe(60000);
    expect(q.payments.milestones).toHaveLength(3);
    expect(q.terms.items.length).toBeGreaterThan(0);
  });

  it("accepts a rupee amount typed with symbols and commas", () => {
    const q = normalizeQuotation({ pricing: { total: "₹1,25,000" } });
    expect(q.pricing.total).toBe(125000);
  });

  it("drops blank rows so the client page never shows an empty bullet", () => {
    const q = normalizeQuotation({ deliverables: { items: ["Album", "", "   ", "Highlight film"] } });
    expect(q.deliverables.items).toEqual(["Album", "Highlight film"]);
  });

  it("drops gallery photos with no image and team rows with no role", () => {
    const q = normalizeQuotation({
      gallery: { photos: [{ url: "/uploads/a.jpg" }, { url: "" }, { caption: "orphan" }] },
      team: { members: [{ count: 2, role: "Photographer", duration: "3 days" }, { count: 1, role: "" }] },
    });
    expect(q.gallery.photos).toHaveLength(1);
    expect(q.team.members).toHaveLength(1);
    expect(q.team.members[0].count).toBe(2);
  });

  it("gives every row an id so React keys stay stable", () => {
    const q = normalizeQuotation({ team: { members: [{ count: 1, role: "Drone Pilot" }] } });
    expect(q.team.members[0].id).toBeTruthy();
  });

  it("ignores id and slug sent by the client — those belong to the server", () => {
    const existing = blankQuotation({ clientName: "Shravan Yadav" });
    const q = normalizeQuotation({ id: "hacked", slug: "hacked", client: { name: "Priya" } }, existing);
    expect(q.id).toBe(existing.id);
    expect(q.slug).toBe(existing.slug);
    expect(q.client.name).toBe("Priya");
  });

  it("falls back to draft for an unknown status", () => {
    expect(normalizeQuotation({ status: "invoiced" }).status).toBe("draft");
  });

  it("keeps untouched sections when merging a partial edit", () => {
    const existing = blankQuotation({ clientName: "Shravan Yadav" });
    const q = normalizeQuotation({ pricing: { total: 90000 } }, existing);
    expect(q.pricing.total).toBe(90000);
    expect(q.deliverables.items).toEqual(existing.deliverables.items);
    expect(q.services.groups).toEqual(existing.services.groups);
  });
});
