/**
 * Shared vocabulary for the vendor profile: the US states an ad or coverage
 * area is keyed to, the slug that names a vendor's public page (/v/<slug>),
 * and the document kinds coordinators most often need on an order.
 *
 * Coverage is stored as (kind, value) rows in vendor_coverage: a STATE row's
 * value is a two-letter code, a COUNTY row's is "County, ST", a ZIP row's is a
 * 5-digit code. Keeping the vocabulary here means the editor, the public page,
 * and the ad marketplace all read the same list.
 */

export const US_STATES: ReadonlyArray<readonly [code: string, name: string]> = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

const STATE_CODES = new Set(US_STATES.map(([code]) => code));

export function isStateCode(value: string): boolean {
  return STATE_CODES.has(value.toUpperCase());
}

export function stateName(code: string): string {
  return US_STATES.find(([c]) => c === code.toUpperCase())?.[1] ?? code;
}

export const COVERAGE_KINDS = ["STATE", "COUNTY", "ZIP"] as const;
export type CoverageKind = (typeof COVERAGE_KINDS)[number];

/**
 * Normalize a coverage value for its kind, or return null if it isn't valid.
 * STATE → uppercased two-letter code; ZIP → 5 digits; COUNTY → trimmed free
 * text (we can't validate every county name, but we cap the length).
 */
export function normalizeCoverage(
  kind: string,
  raw: string,
): { kind: CoverageKind; value: string } | null {
  const value = raw.trim();
  if (kind === "STATE") {
    const code = value.toUpperCase();
    return isStateCode(code) ? { kind: "STATE", value: code } : null;
  }
  if (kind === "ZIP") {
    return /^\d{5}$/.test(value) ? { kind: "ZIP", value } : null;
  }
  if (kind === "COUNTY") {
    return value.length >= 2 && value.length <= 80 ? { kind: "COUNTY", value } : null;
  }
  return null;
}

export function coverageLabel(kind: string, value: string): string {
  if (kind === "STATE") return stateName(value);
  return value;
}

/** Human labels for the VendorCategory enum, shared by every surface that shows one. */
export const VENDOR_CATEGORY_LABELS: Record<string, string> = {
  TITLE: "Title / escrow",
  INSPECTION: "Inspection",
  PHOTOGRAPHY: "Photography",
  SIGNAGE: "Sign installation",
  LEGAL: "Law office",
  OTHER: "Other",
};

export function categoryLabel(category: string): string {
  return VENDOR_CATEGORY_LABELS[category] ?? category;
}

/** The document kinds a coordinator most often needs; free-typed labels are also fine. */
export const SUGGESTED_DOC_LABELS = [
  "Insurance certificate",
  "E&O coverage",
  "W-9",
  "License",
  "Resume / CV",
] as const;

/**
 * A URL-safe slug for a vendor's public page. Not guaranteed unique — the
 * caller resolves collisions by appending -2, -3, … The slug is cosmetic; the
 * public page still re-derives the vendor from it, never trusting the slug as
 * an authorization token.
 */
export function vendorSlugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return base || "vendor";
}
