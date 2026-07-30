/**
 * Contract-extraction result shape + pure mapping helpers.
 *
 * Everything here is side-effect free so the mapping from model output to
 * reviewable field rows (and from applied rows to transaction updates) can be
 * unit-tested without touching the API or the database.
 */

export type Confidence = "high" | "medium" | "low";

export interface CitedValue {
  value: string;
  page: number;
  quote: string;
  confidence: Confidence;
}

export interface DeadlineItem {
  label: string;
  date: string;
  page: number;
  quote: string;
  confidence: Confidence;
}

export interface PartyItem {
  role: string;
  name: string;
  page: number;
  quote: string;
  confidence: Confidence;
}

export interface ContractExtractionResult {
  property_address: CitedValue | null;
  city: CitedValue | null;
  state: CitedValue | null;
  zip: CitedValue | null;
  purchase_price: CitedValue | null;
  contract_date: CitedValue | null;
  close_date: CitedValue | null;
  deadlines: DeadlineItem[];
  parties: PartyItem[];
}

/** JSON schema for structured outputs (additionalProperties: false throughout). */
export const CONTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "property_address",
    "city",
    "state",
    "zip",
    "purchase_price",
    "contract_date",
    "close_date",
    "deadlines",
    "parties",
  ],
  $defs: {
    cited: {
      type: "object",
      additionalProperties: false,
      required: ["value", "page", "quote", "confidence"],
      properties: {
        value: { type: "string" },
        page: { type: "integer", description: "1-based page number where the value appears" },
        quote: { type: "string", description: "Short verbatim quote containing the value" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  },
  properties: {
    property_address: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    city: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    state: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    zip: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    purchase_price: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    contract_date: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    close_date: { anyOf: [{ $ref: "#/$defs/cited" }, { type: "null" }] },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "date", "page", "quote", "confidence"],
        properties: {
          label: { type: "string" },
          date: { type: "string", format: "date" },
          page: { type: "integer" },
          quote: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    parties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "name", "page", "quote", "confidence"],
        properties: {
          role: {
            type: "string",
            enum: [
              "buyer",
              "seller",
              "buyer_agent",
              "listing_agent",
              "lender",
              "title_company",
              "attorney",
              "other",
            ],
          },
          name: { type: "string" },
          page: { type: "integer" },
          quote: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
} as const;

// --- Flattening model output into reviewable field rows ---

export interface FlatField {
  key: string;
  label: string;
  value: string;
  valueType: "TEXT" | "DATE" | "MONEY";
  page: number | null;
  quote: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  target: "TRANSACTION_FIELD" | "TASK" | "CUSTOM_FIELD" | "PARTY";
  sortOrder: number;
}

const SCALAR_DEFS: Array<{
  key: keyof ContractExtractionResult;
  label: string;
  valueType: FlatField["valueType"];
}> = [
  { key: "property_address", label: "Property address", valueType: "TEXT" },
  { key: "city", label: "City", valueType: "TEXT" },
  { key: "state", label: "State", valueType: "TEXT" },
  { key: "zip", label: "ZIP", valueType: "TEXT" },
  { key: "purchase_price", label: "Purchase price", valueType: "MONEY" },
  { key: "contract_date", label: "Contract (effective) date", valueType: "DATE" },
  { key: "close_date", label: "Closing date", valueType: "DATE" },
];

/** Friendly labels for the contract-party roles the model returns. Shared by
 *  the extractor and the transaction's locked Parties panel. */
export const PARTY_LABEL: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  buyer_agent: "Buyer's agent",
  listing_agent: "Listing agent",
  lender: "Lender",
  title_company: "Title company",
  attorney: "Attorney",
  other: "Other party",
};

export function partyLabel(role: string): string {
  return PARTY_LABEL[role] ?? "Other party";
}

/**
 * An extraction role ("buyer_agent") → the matching TransactionParty role
 * ("BUYER_AGENT"), for turning a landing-list entry into a real party.
 *
 * The two vocabularies happen to be the same words in different casing —
 * this checks that rather than assuming it: extraction output isn't
 * guaranteed against the Prisma enum, so a role the enum doesn't recognize
 * falls back to `fallback` instead of producing a value the caller can't
 * actually store. Generic over the valid-roles list so this file doesn't
 * need to import the Prisma enum to stay pure and DB-free.
 */
export function matchPartyRole<T extends string>(
  role: string,
  validRoles: readonly T[],
  fallback: T,
): T {
  const upper = role.toUpperCase();
  return (validRoles as readonly string[]).includes(upper) ? (upper as T) : fallback;
}

/**
 * One entry in a transaction's contract-extraction landing list.
 *
 * Deliberately plain text with no link to a Contact — a name the extractor
 * read off a PDF hasn't been matched to any particular record yet. Turning
 * one into a real party (with an email, a phone, a page that shows every
 * file they're on) happens through lib/actions/parties.ts's linkExtractedParty,
 * which creates a proper TransactionParty and removes the entry here — this
 * array is a queue of suggestions, not the record of who's on the file.
 */
export interface ContractParty {
  role: string;
  value: string;
}

const CONF: Record<Confidence, FlatField["confidence"]> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export function flattenExtraction(result: ContractExtractionResult): FlatField[] {
  const rows: FlatField[] = [];
  let order = 0;

  for (const def of SCALAR_DEFS) {
    const cited = result[def.key] as CitedValue | null;
    if (!cited?.value.trim()) continue;
    rows.push({
      key: def.key,
      label: def.label,
      value: cited.value.trim(),
      valueType: def.valueType,
      page: cited.page,
      quote: cited.quote,
      confidence: CONF[cited.confidence] ?? "LOW",
      target: "TRANSACTION_FIELD",
      sortOrder: order++,
    });
  }

  for (const d of result.deadlines ?? []) {
    if (!d.label.trim() || !d.date.trim()) continue;
    rows.push({
      key: `deadline:${d.label.trim()}`,
      label: d.label.trim(),
      value: d.date.trim(),
      valueType: "DATE",
      page: d.page,
      quote: d.quote,
      confidence: CONF[d.confidence] ?? "LOW",
      target: "TASK",
      sortOrder: order++,
    });
  }

  for (const p of result.parties ?? []) {
    if (!p.name.trim()) continue;
    const label = PARTY_LABEL[p.role] ?? "Other party";
    rows.push({
      key: `party:${p.role}`,
      label: `${label} (from contract)`,
      value: p.name.trim(),
      valueType: "TEXT",
      page: p.page,
      quote: p.quote,
      confidence: CONF[p.confidence] ?? "LOW",
      target: "PARTY",
      sortOrder: order++,
    });
  }

  return rows;
}

// --- Applying rows back onto a transaction ---

/** "YYYY-MM-DD" -> UTC midnight Date, else null. */
export function parseDateValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "$385,000.00" / "385000" -> 385000, else null. */
export function parseMoneyValue(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned));
}

/** Maps an applied TRANSACTION_FIELD row to a Prisma update fragment. */
export function transactionUpdateFor(key: string, value: string): Record<string, unknown> | null {
  switch (key) {
    case "property_address":
      return { propertyAddress: value };
    case "city":
      return { city: value };
    case "state":
      return { state: value };
    case "zip":
      return { zip: value };
    case "purchase_price": {
      const n = parseMoneyValue(value);
      return n == null ? null : { purchasePrice: n };
    }
    case "contract_date": {
      const d = parseDateValue(value);
      return d == null ? null : { contractDate: d };
    }
    case "close_date": {
      const d = parseDateValue(value);
      return d == null ? null : { closeDate: d };
    }
    // Derived from the client named at upload, not read off the page — and
    // checked against the enum here because the reviewer can change it in a
    // <select> before applying. A blank (nothing matched, nothing picked)
    // applies nothing rather than defaulting the file to a side.
    case "side":
      return ["BUY_SIDE", "SELL_SIDE", "DUAL"].includes(value) ? { side: value } : null;
    default:
      return null;
  }
}
