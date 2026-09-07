import { describe, expect, it } from "vitest";
import { clientDisplayName, coupleName, resolveAmountInWords, resolveMilestones, resolveTotal, whatsappLink } from "@/lib/compute";
import { blankQuotation } from "@/lib/defaults";

function withLineItems() {
  const q = blankQuotation({ clientName: "Shravan Yadav" });
  q.pricing.showLineItems = true;
  q.pricing.lineItems = [
    { id: "a", label: "Photography", note: "", amount: 35000 },
    { id: "b", label: "Videography", note: "", amount: 30000 },
  ];
  return q;
}

describe("resolveTotal", () => {
  it("uses the flat total when the breakdown is off", () => {
    expect(resolveTotal(blankQuotation())).toBe(60000);
  });

  it("uses the sum of the lines when the breakdown is on, so the two can never disagree", () => {
    const q = withLineItems();
    q.pricing.total = 1; // stale value from before the breakdown was switched on
    expect(resolveTotal(q)).toBe(65000);
  });
});

describe("resolveAmountInWords", () => {
  it("derives the words from the resolved total", () => {
    expect(resolveAmountInWords(blankQuotation())).toBe("Sixty Thousand Only");
  });

  it("respects an override typed by the admin", () => {
    const q = blankQuotation();
    q.pricing.amountInWordsOverride = "Sixty Thousand Rupees Only (inclusive of travel)";
    expect(resolveAmountInWords(q)).toBe("Sixty Thousand Rupees Only (inclusive of travel)");
  });
});

describe("resolveMilestones", () => {
  it("prices the 30/40/30 schedule off the resolved total", () => {
    const amounts = resolveMilestones(withLineItems()).map((m) => m.amount);
    expect(amounts).toEqual([19500, 26000, 19500]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(65000);
  });
});

describe("names", () => {
  it("shows both names when a partner is given", () => {
    const q = blankQuotation({ clientName: "Shravan" });
    q.client.partnerName = "Priya";
    expect(coupleName(q)).toBe("Shravan & Priya");
  });

  it("shows one name when no partner is given", () => {
    expect(coupleName(blankQuotation({ clientName: "Shravan Yadav" }))).toBe("Shravan Yadav");
  });

  it("never leaves a dangling space when the salutation is blank", () => {
    const q = blankQuotation({ clientName: "Shravan Yadav" });
    q.client.salutation = "";
    expect(clientDisplayName(q)).toBe("Shravan Yadav");
  });
});

describe("whatsappLink", () => {
  it("strips formatting from the number and encodes the message", () => {
    const q = blankQuotation();
    q.signoff.whatsapp = "+91 81097 05662";
    expect(whatsappLink(q, "Hi there")).toBe("https://wa.me/918109705662?text=Hi%20there");
  });

  it("returns nothing when no WhatsApp number is set, so no dead button renders", () => {
    const q = blankQuotation();
    q.signoff.whatsapp = "";
    expect(whatsappLink(q, "Hi")).toBe("");
  });
});
