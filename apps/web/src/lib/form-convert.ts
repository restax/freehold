/**
 * Turning a reviewed submission into real records.
 *
 * Everything here reads the submission's own snapshot and answers — never
 * the live form — so a form edited after the fact can't change what an old
 * submission converts into. Mapped keys (MAPPED_FIELDS in form-schema) are
 * the contract: a key that binds to a column lands in that column, and
 * anything else stays a custom answer on the submission.
 *
 * Dependency-free (the billing-cadence pattern): this is the step that
 * writes a stranger's typing into the workspace's real pipeline, so the
 * mapping is unit-tested rather than trusted.
 */

import { type PartyValue, parseParty } from "./form-schema";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** "$1,250,000" → 1250000. Money arrives with typing noise. */
export function parseWholeNumber(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number.parseInt(s.replace(/[$,\s]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** "YYYY-MM-DD" → UTC midnight, matching the @db.Date columns. */
export function parseDateOnly(v: unknown): Date | null {
  const s = str(v);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type TransactionSideValue = "BUY_SIDE" | "SELL_SIDE" | "DUAL";

const SIDE_BY_ANSWER: Record<string, TransactionSideValue> = {
  "buy side": "BUY_SIDE",
  "sell side": "SELL_SIDE",
  "dual (both sides)": "DUAL",
  dual: "DUAL",
};

export function parseSide(v: unknown): TransactionSideValue | null {
  const s = str(v);
  return s ? (SIDE_BY_ANSWER[s.toLowerCase()] ?? null) : null;
}

export type ClientTypeValue = "AGENT" | "BROKERAGE" | "TEAM";

const CLIENT_TYPE_BY_ANSWER: Record<string, ClientTypeValue> = {
  "individual agent": "AGENT",
  agent: "AGENT",
  brokerage: "BROKERAGE",
  team: "TEAM",
};

export function parseClientType(v: unknown): ClientTypeValue | null {
  const s = str(v);
  return s ? (CLIENT_TYPE_BY_ANSWER[s.toLowerCase()] ?? null) : null;
}

export type PartyRoleValue =
  | "BUYER"
  | "SELLER"
  | "BUYER_AGENT"
  | "LISTING_AGENT"
  | "ATTORNEY"
  | "LENDER"
  | "TITLE_COMPANY"
  | "INSPECTOR";

/** Which mapped party key becomes which role on the file. */
export const PARTY_ROLE_BY_KEY: Record<string, PartyRoleValue> = {
  buyer: "BUYER",
  seller: "SELLER",
  buyerAgent: "BUYER_AGENT",
  listingAgent: "LISTING_AGENT",
  attorney: "ATTORNEY",
  lender: "LENDER",
  titleCompany: "TITLE_COMPANY",
  inspector: "INSPECTOR",
};

export interface PartyDraft extends PartyValue {
  role: PartyRoleValue;
  name: string;
}

/**
 * Parties worth creating: only those with a name, because a contact record
 * with an email and no name is noise in the CRM.
 */
export function partiesFrom(values: Record<string, unknown>): PartyDraft[] {
  const out: PartyDraft[] = [];
  for (const [key, role] of Object.entries(PARTY_ROLE_BY_KEY)) {
    const party = parseParty(values[key]);
    if (party?.name) out.push({ ...party, role, name: party.name });
  }
  return out;
}

export interface ClientDraft {
  name: string;
  type: ClientTypeValue;
  email: string | null;
  phone: string | null;
  address: string | null;
  brokerageInfo: Record<string, string> | null;
  billingContact: Record<string, string> | null;
}

/**
 * A new-client submission as a Client. Returns null without a name — the
 * one field a client record cannot be created without.
 */
export function clientDraftFrom(values: Record<string, unknown>): ClientDraft | null {
  const name = str(values.clientName);
  if (!name) return null;

  const brokerage: Record<string, string> = {};
  for (const [k, v] of [
    ["name", values.brokerageName],
    ["phone", values.brokeragePhone],
    ["address", values.brokerageAddress],
  ] as const) {
    const s = str(v);
    if (s) brokerage[k] = s;
  }
  const billing: Record<string, string> = {};
  for (const [k, v] of [
    ["name", values.billingName],
    ["email", values.billingEmail],
    ["phone", values.billingPhone],
  ] as const) {
    const s = str(v);
    if (s) billing[k] = s;
  }

  const type = parseClientType(values.clientType) ?? "AGENT";
  return {
    name,
    type,
    email: str(values.email),
    phone: str(values.phone),
    address: str(values.address),
    // A brokerage reference only makes sense for an individual agent; a
    // billing contact only for an office. Keeping that rule here means a
    // converted record can't contradict what the client page will show.
    brokerageInfo: type === "AGENT" && Object.keys(brokerage).length > 0 ? brokerage : null,
    billingContact: type !== "AGENT" && Object.keys(billing).length > 0 ? billing : null,
  };
}

export interface TransactionDraft {
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  side: TransactionSideValue;
  purchasePrice: number | null;
  listPrice: number | null;
  contractDate: Date | null;
  closeDate: Date | null;
  listDate: Date | null;
  expireDate: Date | null;
  mlsId: string | null;
  notes: string | null;
}

/**
 * A transaction submission as a Transaction. Returns null without a
 * property address — a file with no address is unusable.
 */
export function transactionDraftFrom(values: Record<string, unknown>): TransactionDraft | null {
  const propertyAddress = str(values.propertyAddress);
  if (!propertyAddress) return null;
  return {
    propertyAddress,
    city: str(values.city),
    state: str(values.state)?.slice(0, 2).toUpperCase() ?? null,
    zip: str(values.zip),
    side: parseSide(values.side) ?? "BUY_SIDE",
    purchasePrice: parseWholeNumber(values.purchasePrice),
    listPrice: parseWholeNumber(values.listPrice),
    contractDate: parseDateOnly(values.contractDate),
    closeDate: parseDateOnly(values.closeDate),
    // A listing form asks when the property goes live and when the agreement
    // runs out; without these the two dates a listing is actually about would
    // land in the notes as text nothing can sort or remind on.
    listDate: parseDateOnly(values.listDate),
    expireDate: parseDateOnly(values.expireDate),
    mlsId: str(values.mlsId),
    notes: str(values.notes),
  };
}

/**
 * A listing submission is sell-side unless the form said otherwise — the
 * question is usually not worth asking on a form that only exists because
 * somebody took a listing.
 */
export function listingDraftFrom(values: Record<string, unknown>): TransactionDraft | null {
  const draft = transactionDraftFrom(values);
  if (!draft) return null;
  return { ...draft, side: parseSide(values.side) ?? "SELL_SIDE" };
}

/**
 * Answers the converter doesn't map anywhere — the TC's own custom
 * questions. Kept so the file's notes can carry them instead of the
 * answers silently vanishing at conversion.
 */
export function unmappedAnswers(
  values: Record<string, unknown>,
  mappedKeys: readonly string[],
): Array<{ key: string; value: string }> {
  const mapped = new Set(mappedKeys);
  const out: Array<{ key: string; value: string }> = [];
  for (const [key, raw] of Object.entries(values)) {
    if (mapped.has(key)) continue;
    const party = parseParty(raw);
    if (party) {
      const parts = [party.name, party.email, party.phone].filter(Boolean).join(" · ");
      if (parts) out.push({ key, value: parts });
      continue;
    }
    if (typeof raw === "boolean") {
      out.push({ key, value: raw ? "Yes" : "No" });
      continue;
    }
    const s = str(raw);
    if (s) out.push({ key, value: s });
  }
  return out;
}
