/**
 * Buyer- and seller-side intake forms shown on client portals. Fixed field
 * sets (a form builder is deliberately out of scope); labels come from the
 * tenant's side wording. Uploads become Document rows on the transaction.
 */

export interface IntakeField {
  id: string;
  label: string;
  type?: "text" | "textarea" | "email" | "tel";
  required?: boolean;
  placeholder?: string;
}

export const BUY_INTAKE_FIELDS: IntakeField[] = [
  {
    id: "legalNames",
    label: "Full legal name(s), exactly as they should appear on title",
    required: true,
  },
  { id: "email", label: "Best email", type: "email", required: true },
  { id: "phone", label: "Best phone", type: "tel" },
  { id: "currentAddress", label: "Current address" },
  {
    id: "titleHolding",
    label: "How will you hold title?",
    placeholder: "e.g. joint tenants, LLC, trust",
  },
  { id: "lender", label: "Lender & loan officer", placeholder: "Company, name, phone or email" },
  { id: "attorney", label: "Attorney (if any)", placeholder: "Name and contact" },
  { id: "notes", label: "Anything else we should know?", type: "textarea" },
];

export const SELL_INTAKE_FIELDS: IntakeField[] = [
  { id: "legalNames", label: "Full legal name(s) as they appear on the deed", required: true },
  { id: "email", label: "Best email", type: "email", required: true },
  { id: "phone", label: "Best phone", type: "tel" },
  { id: "forwardingAddress", label: "Forwarding address after closing" },
  {
    id: "mortgage",
    label: "Current mortgage lender & approximate payoff",
    placeholder: "Lender, loan number if handy",
  },
  { id: "hoa", label: "HOA (if any)", placeholder: "Name, contact, monthly fee" },
  { id: "attorney", label: "Attorney (if any)", placeholder: "Name and contact" },
  { id: "notes", label: "Anything else we should know?", type: "textarea" },
];

export const INTAKE_UPLOAD_HINT: Record<"buy" | "sell", string> = {
  buy: "Helpful uploads: pre-approval letter, proof of funds.",
  sell: "Helpful uploads: deed, recent tax bill, HOA documents, survey.",
};

export function intakeFields(kind: "buy" | "sell"): IntakeField[] {
  return kind === "buy" ? BUY_INTAKE_FIELDS : SELL_INTAKE_FIELDS;
}
