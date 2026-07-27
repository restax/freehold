/**
 * Client profile shapes and the reading rules around them. A TC's client is
 * one of two things that matter structurally: an individual agent (who hangs
 * their license with a brokerage we keep on file as plain reference info) or
 * an office — a brokerage or a team — which has a roster of agents and often
 * a billing contact who actually pays the invoices. Dependency-free (the
 * billing-cadence pattern) so the recipient rule that decides where money
 * emails go is unit-tested.
 */

export interface BillingContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface BrokerageInfo {
  name: string | null;
  phone: string | null;
  address: string | null;
}

/** One label map for every page that names a client type. */
export const CLIENT_TYPE_LABEL: Record<string, string> = {
  AGENT: "Agent",
  BROKERAGE: "Brokerage",
  TEAM: "Team",
  TITLE: "Title company",
  LENDER: "Lender",
  OTHER: "Other",
};

/** The two structural kinds plus everything else (title, lender, other). */
export type ClientKind = "individual" | "office" | "company";

export function clientKind(type: string): ClientKind {
  if (type === "AGENT") return "individual";
  if (type === "BROKERAGE" || type === "TEAM") return "office";
  return "company";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Tolerant parse — malformed or missing JSON reads as "not set". */
export function billingContactFrom(json: unknown): BillingContact | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const c: BillingContact = {
    name: strOrNull(o.name),
    email: strOrNull(o.email),
    phone: strOrNull(o.phone),
  };
  return c.name || c.email || c.phone ? c : null;
}

export function brokerageInfoFrom(json: unknown): BrokerageInfo | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const b: BrokerageInfo = {
    name: strOrNull(o.name),
    phone: strOrNull(o.phone),
    address: strOrNull(o.address),
  };
  return b.name || b.phone || b.address ? b : null;
}

/**
 * Where invoice emails go: the billing contact when one has an email — the
 * office manager pays the bills, not the broker — else the client's own
 * email, else nowhere (null).
 */
export function invoiceRecipient(client: {
  email: string | null;
  billingContact: unknown;
}): string | null {
  return billingContactFrom(client.billingContact)?.email ?? client.email;
}
