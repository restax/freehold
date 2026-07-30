import { prisma, withTenant } from "@freehold/db";
import { fmtDate } from "@/lib/format";

/**
 * The expanded merge context for library email templates (the hub's Emails
 * tab, and compose-from-a-task/transaction) — a superset of
 * `transactionMergeContext` in lib/auto-emails.ts, which stays as-is for the
 * two automated lifecycle emails. Every code here resolves from data that
 * genuinely exists today; nothing renders a promise we can't keep, which is
 * why some plausible codes (a mailing address block, a commission
 * breakdown) aren't here yet — they need data this compose flow doesn't
 * have access to.
 */

export interface MergeFieldGroup {
  label: string;
  codes: string[];
}

export const MERGE_FIELD_GROUPS: MergeFieldGroup[] = [
  {
    label: "Contact fields",
    codes: [
      "client_name",
      "client_first_name",
      "agent_email",
      "agent_first_name",
      "other_agent_email",
      "other_agent_first_name",
      "lender_name",
      "lender_email",
      "title_company_name",
      "title_company_email",
      "buyer_name",
      "buyer_emails",
      "seller_name",
      "seller_emails",
      "buyer_agent_name",
      "listing_agent_name",
    ],
  },
  {
    label: "Transaction fields",
    codes: ["property_address", "property_full_address", "tenant_name", "last_names"],
  },
  {
    label: "Transaction date fields",
    codes: [
      "close_date",
      "contract_date",
      "effective_date",
      "list_date",
      "expire_date",
      "inspection_deadline",
      "mortgage_commitment_date",
      "earnest_money_due",
      "current_date",
      "key_dates",
    ],
  },
  {
    label: "Transaction participant fields",
    codes: ["parties_list", "closer_card"],
  },
  {
    label: "Other fields",
    codes: [
      "tc_name",
      "tc_first_name",
      "tc_email",
      "tc_phone",
      "task_title",
      "task_due",
      "review_link",
      "portal_link",
      "agent_portal_link",
      "earnest_money",
      "due_diligence_fee",
    ],
  },
];

const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] ?? "";
const lastName = (full: string | null | undefined) => {
  const parts = (full ?? "").trim().split(/\s+/);
  return parts.length > 0 ? (parts[parts.length - 1] ?? "") : "";
};

/**
 * Everything the merge context needs, gathered in one query. Kept separate
 * from `emailContextForTransaction` (auto-emails.ts) because that one is
 * shaped around the branded signature-card layout; this one is shaped
 * around flat merge codes and pulls a few extra relations (portal links,
 * assignees) that layout never needed.
 */
export async function buildTemplateMergeContext(
  tenantId: string,
  transactionId: string,
  tc: { name?: string | null; email?: string | null },
): Promise<Record<string, string>> {
  const [txn, org, portalLinks] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.transaction.findUnique({
        where: { id: transactionId },
        include: { client: true, parties: { include: { contact: true } } },
      }),
      tx.organization.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
      tx.portalLink.findMany({
        where: { transactionId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { audience: true, token: true },
      }),
    ]),
  );
  if (!txn) return {};

  const partiesByRole = (role: string) => txn.parties.filter((p) => p.role === role);
  const party = (role: string) => partiesByRole(role)[0]?.contact.name ?? "";
  const partyEmails = (role: string) =>
    partiesByRole(role)
      .map((p) => p.contact.email)
      .filter((e): e is string => Boolean(e))
      .join("; ");

  const otherRole = txn.side === "BUY_SIDE" ? "LISTING_AGENT" : "BUYER_AGENT";
  const other = partiesByRole(otherRole)[0]?.contact ?? null;
  const closer = partiesByRole("TITLE_COMPANY")[0]?.contact ?? null;

  const fullAddress = [
    txn.propertyAddress,
    txn.city,
    [txn.state, txn.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const buyerNames = partiesByRole("BUYER")
    .map((p) => p.contact.name)
    .filter(Boolean);
  const sellerNames = partiesByRole("SELLER")
    .map((p) => p.contact.name)
    .filter(Boolean);
  const lastNames = [...new Set([...buyerNames, ...sellerNames].map(lastName))]
    .filter(Boolean)
    .join(" & ");

  const dateLines: string[] = [];
  const addDate = (label: string, d: Date | null) => {
    if (d) dateLines.push(`${label}: ${fmtDate(d)}`);
  };
  addDate("Contract date", txn.contractDate);
  addDate("List date", txn.listDate);
  addDate("Earnest money due", txn.earnestMoneyDueDate);
  addDate("Inspection deadline", txn.inspectionDeadlineDate);
  addDate("Mortgage commitment", txn.mortgageCommitmentDate);
  addDate("Closing", txn.closeDate);
  addDate("Listing expires", txn.expireDate);

  const partyLines = txn.parties
    .filter((p) => p.contact.email || p.contact.phone)
    .map(
      (p) =>
        `${p.role.replace(/_/g, " ")}: ${p.contact.name} — ${p.contact.email ?? p.contact.phone}`,
    );

  const customFields = (txn.customFields as Record<string, string> | null) ?? {};

  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const clientLink = portalLinks.find((l) => l.audience === "CLIENT");
  const agentLink = portalLinks.find((l) => l.audience === "AGENT");

  return {
    // Contact fields
    client_name: txn.client?.name ?? "",
    client_first_name: firstName(txn.client?.name),
    agent_email: txn.client?.email ?? "",
    agent_first_name: firstName(txn.client?.name),
    other_agent_email: other?.email ?? "",
    other_agent_first_name: firstName(other?.name),
    lender_name: party("LENDER"),
    lender_email: partiesByRole("LENDER")[0]?.contact.email ?? "",
    title_company_name: closer?.name ?? "",
    title_company_email: closer?.email ?? "",
    buyer_name: party("BUYER"),
    buyer_emails: partyEmails("BUYER"),
    seller_name: party("SELLER"),
    seller_emails: partyEmails("SELLER"),
    buyer_agent_name: party("BUYER_AGENT"),
    listing_agent_name: party("LISTING_AGENT"),
    // Transaction fields
    property_address: txn.propertyAddress,
    property_full_address: fullAddress,
    tenant_name: org.name,
    last_names: lastNames,
    // Transaction date fields
    close_date: txn.closeDate ? fmtDate(txn.closeDate) : "",
    contract_date: txn.contractDate ? fmtDate(txn.contractDate) : "",
    effective_date: txn.contractDate ? fmtDate(txn.contractDate) : "",
    list_date: txn.listDate ? fmtDate(txn.listDate) : "",
    expire_date: txn.expireDate ? fmtDate(txn.expireDate) : "",
    inspection_deadline: txn.inspectionDeadlineDate ? fmtDate(txn.inspectionDeadlineDate) : "",
    mortgage_commitment_date: txn.mortgageCommitmentDate ? fmtDate(txn.mortgageCommitmentDate) : "",
    earnest_money_due: txn.earnestMoneyDueDate ? fmtDate(txn.earnestMoneyDueDate) : "",
    current_date: fmtDate(new Date()),
    key_dates: dateLines.join("\n"),
    // Transaction participant fields
    parties_list: partyLines.join("\n"),
    closer_card: closer ? [closer.name, closer.email, closer.phone].filter(Boolean).join("\n") : "",
    // Other fields
    tc_name: tc.name ?? org.name,
    tc_first_name: firstName(tc.name),
    tc_email: tc.email ?? "",
    tc_phone: "",
    task_title: "",
    task_due: "",
    review_link: "",
    portal_link: clientLink ? `${base}/portal/${clientLink.token}` : "",
    agent_portal_link: agentLink ? `${base}/portal/${agentLink.token}` : "",
    earnest_money: customFields.earnestMoney ?? "",
    due_diligence_fee: customFields.dueDiligenceFee ?? "",
  };
}

/** Sample values for the "Test" send — a template rendered against a
 *  transaction can be tested for real; a template edited before ever being
 *  attached to one still needs *something* to preview against. */
export function sampleMergeContext(tenantName: string): Record<string, string> {
  return {
    client_name: "Jane Agent",
    client_first_name: "Jane",
    agent_email: "jane@example.com",
    agent_first_name: "Jane",
    other_agent_email: "sam@example.com",
    other_agent_first_name: "Sam",
    lender_name: "Riverside Lending",
    lender_email: "lending@example.com",
    title_company_name: "Clearwater Title",
    title_company_email: "closer@example.com",
    buyer_name: "Alex Buyer",
    buyer_emails: "alex@example.com",
    seller_name: "Sam Seller",
    seller_emails: "sam.seller@example.com",
    buyer_agent_name: "Pat Buyeragent",
    listing_agent_name: "Jane Agent",
    property_address: "123 Main St",
    property_full_address: "123 Main St, Springfield, IL 62704",
    tenant_name: tenantName,
    last_names: "Buyer & Seller",
    close_date: fmtDate(new Date()),
    contract_date: fmtDate(new Date()),
    effective_date: fmtDate(new Date()),
    list_date: fmtDate(new Date()),
    expire_date: "",
    inspection_deadline: fmtDate(new Date()),
    mortgage_commitment_date: fmtDate(new Date()),
    earnest_money_due: fmtDate(new Date()),
    current_date: fmtDate(new Date()),
    key_dates: `Contract date: ${fmtDate(new Date())}\nClosing: ${fmtDate(new Date())}`,
    parties_list:
      "BUYER: Alex Buyer — alex@example.com\nSELLER: Sam Seller — sam.seller@example.com",
    closer_card: "Clearwater Title\ncloser@example.com",
    tc_name: "Your name",
    tc_first_name: "Your",
    tc_email: "you@example.com",
    tc_phone: "",
    task_title: "Sample task",
    task_due: fmtDate(new Date()),
    review_link: `https://example.com/review/sample`,
    portal_link: `https://example.com/portal/sample`,
    agent_portal_link: `https://example.com/portal/sample-agent`,
    earnest_money: "$1,000",
    due_diligence_fee: "$250",
  };
}

/** Workspace name for the sample context, without needing a transaction. */
export async function tenantName(tenantId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return org?.name ?? "Your workspace";
}
