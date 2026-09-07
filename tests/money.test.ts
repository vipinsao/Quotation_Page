import { describe, expect, it } from "vitest";
import { formatINR, numberToIndianWords, splitByPercent, sumLineItems } from "@/lib/money";

describe("numberToIndianWords", () => {
  it("matches the wording on the studio's existing quotation", () => {
    expect(numberToIndianWords(60000)).toBe("Sixty Thousand Only");
  });

  it("uses the Indian lakh/crore grouping, not million/billion", () => {
    expect(numberToIndianWords(125000)).toBe("One Lakh Twenty Five Thousand Only");
    expect(numberToIndianWords(1500000)).toBe("Fifteen Lakh Only");
    expect(numberToIndianWords(10000000)).toBe("One Crore Only");
    expect(numberToIndianWords(12345678)).toBe(
      "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });

  it("handles the small and awkward numbers", () => {
    expect(numberToIndianWords(0)).toBe("Zero Only");
    expect(numberToIndianWords(7)).toBe("Seven Only");
    expect(numberToIndianWords(19)).toBe("Nineteen Only");
    expect(numberToIndianWords(20)).toBe("Twenty Only");
    expect(numberToIndianWords(100)).toBe("One Hundred Only");
    expect(numberToIndianWords(999)).toBe("Nine Hundred Ninety Nine Only");
    expect(numberToIndianWords(1001)).toBe("One Thousand One Only");
  });

  it("reads out paise when the amount is not whole", () => {
    expect(numberToIndianWords(250000.5)).toBe("Two Lakh Fifty Thousand and Fifty Paise Only");
  });

  it("does not throw on junk input", () => {
    expect(numberToIndianWords(Number.NaN)).toBe("");
    expect(numberToIndianWords(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("formatINR", () => {
  it("groups digits the Indian way", () => {
    expect(formatINR(60000)).toBe("₹60,000");
    expect(formatINR(1250000)).toBe("₹12,50,000");
  });

  it("hides decimals on whole rupee amounts and shows them otherwise", () => {
    expect(formatINR(1000)).toBe("₹1,000");
    expect(formatINR(1000.5)).toBe("₹1,000.50");
  });
});

describe("splitByPercent", () => {
  it("turns the 30/40/30 schedule into rupees", () => {
    expect(splitByPercent(60000, [30, 40, 30])).toEqual([18000, 24000, 18000]);
  });

  it("always sums back to the total, even when percentages do not divide cleanly", () => {
    const amounts = splitByPercent(100000, [33, 33, 33]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it("survives percentages that do not add to 100", () => {
    const amounts = splitByPercent(50000, [50, 20]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(50000);
  });

  it("returns nothing for an empty schedule", () => {
    expect(splitByPercent(60000, [])).toEqual([]);
  });
});

describe("sumLineItems", () => {
  it("adds up the itemised breakdown", () => {
    expect(sumLineItems([{ amount: 25000 }, { amount: 15000 }, { amount: 20000 }])).toBe(60000);
  });
});
