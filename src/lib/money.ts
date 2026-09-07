const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–99 in words. */
function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** 0–999 in words. */
function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(" ");
}

/**
 * Rupee amounts in the Indian numbering system (crore / lakh / thousand),
 * which is what clients here expect to read next to the figure.
 */
export function numberToIndianWords(value: number): string {
  if (!Number.isFinite(value)) return "";

  const negative = value < 0;
  const abs = Math.abs(value);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const parts: string[] = [];
  let remaining = rupees;

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  // Crores can exceed 999, so they recurse through the same grouping.
  if (crore) parts.push(`${crore > 999 ? numberToIndianWords(crore).replace(/ Only$/, "") : underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (remaining) parts.push(underThousand(remaining));

  let words = parts.join(" ").trim();
  if (!words) words = "Zero";
  if (paise > 0) words += ` and ${underHundred(paise)} Paise`;

  return `${negative ? "Minus " : ""}${words} Only`;
}

/** ₹60,000 — Indian digit grouping, no decimals for whole amounts. */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  const hasPaise = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(value);
}

/**
 * Turns percentage milestones into rupee amounts. The final milestone absorbs
 * any rounding remainder so the schedule always sums to the total exactly.
 */
export function splitByPercent(total: number, percents: number[]): number[] {
  if (percents.length === 0) return [];
  const amounts = percents.map((p) => Math.round((total * p) / 100));
  const drift = total - amounts.reduce((sum, a) => sum + a, 0);
  amounts[amounts.length - 1] += drift;
  return amounts;
}

export function sumLineItems(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}
