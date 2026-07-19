/** Dual-person contact helpers shared by forms, lists, and the detail view. */

export interface PersonFields {
  title?: string;
  first?: string;
  middle?: string;
  last?: string;
  jobTitle?: string;
  cell?: string;
  workPhone?: string;
  email?: string;
}

export interface MonthDay {
  m?: number;
  d?: number;
  y?: number;
}

export interface TouchDates {
  birthday?: MonthDay;
  birthdayAlt?: MonthDay;
  weddingAnniversary?: MonthDay;
  purchaseAnniversary?: MonthDay;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Relationship grade → auto-prospecting cadence in days. */
export const GRADE_CADENCE: Record<string, number> = { A: 30, B: 60, C: 90, D: 180 };
export const GRADES = ["A", "B", "C", "D"] as const;

export const SUGGESTED_CATEGORIES = [
  "Sphere",
  "Monthly Mailer",
  "Past Client",
  "Potential Agent Client",
  "Vendor",
  "Lender",
  "Title",
  "Agent",
];

export const TOUCH_DATE_LABELS: Record<keyof TouchDates, string> = {
  birthday: "Birthday",
  birthdayAlt: "Birthday (spouse/alt)",
  weddingAnniversary: "Wedding anniversary",
  purchaseAnniversary: "Purchase anniversary",
};

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Jordan Bell" / "Jordan & Casey Bell" / "Jordan Bell & Casey Rivera". */
export function displayName(
  primary: { first?: string; last?: string },
  secondary?: { first?: string; last?: string } | null,
  fallback = "Unnamed contact",
): string {
  const p = [primary.first, primary.last].filter(Boolean).join(" ").trim();
  if (!secondary?.first && !secondary?.last) return p || fallback;
  const sameLast = secondary.last === primary.last || !secondary.last;
  const s = sameLast
    ? (secondary.first ?? "")
    : [secondary.first, secondary.last].filter(Boolean).join(" ");
  if (!p) return s || fallback;
  if (sameLast && primary.first && secondary.first && primary.last) {
    return `${primary.first} & ${secondary.first} ${primary.last}`;
  }
  return s ? `${p} & ${s}` : p;
}

export function nextTouchFrom(grade: string | null | undefined, from = new Date()): Date | null {
  const days = grade ? GRADE_CADENCE[grade] : undefined;
  if (!days) return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function fmtMonthDay(md: MonthDay | undefined): string | null {
  if (!md?.m || !md?.d) return null;
  return `${MONTHS[md.m - 1]} ${md.d}${md.y ? `, ${md.y}` : ""}`;
}
