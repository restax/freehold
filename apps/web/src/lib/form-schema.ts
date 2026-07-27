/**
 * The intake-form document model and the rules around it.
 *
 * A form is an ordered list of rows; a row holds one or two cells; a cell is
 * either an input field or a static block (divider / heading / paragraph).
 * That shape is deliberate: it gives the designer a single drag target
 * ("put this cell in that slot") instead of free geometry, and it renders as
 * a plain server-side grid with no layout engine.
 *
 * Field keys come in two flavours. A *mapped* key (MAPPED_FIELDS) binds to a
 * real column when a submission is converted into a Client or Transaction —
 * that binding is what makes one-click convert possible. Any other key is a
 * custom question whose answer simply lives in the submission.
 *
 * Dependency-free (the billing-cadence pattern): every rule that decides
 * whether a stranger's submission is valid is unit-tested without pulling the
 * app's module graph in.
 */

export const FORM_KINDS = ["client_intake", "transaction_intake"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export const FORM_KIND_LABEL: Record<string, string> = {
  client_intake: "New client",
  transaction_intake: "New transaction",
};

export function isFormKind(v: string): v is FormKind {
  return (FORM_KINDS as readonly string[]).includes(v);
}

/** Inputs a cell can be. "party" captures a name/email/phone trio in one cell. */
export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "tel",
  "number",
  "date",
  "select",
  "checkbox",
  "file",
  "party",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Static furniture — no answer, no key. */
export const BLOCK_TYPES = ["divider", "heading", "paragraph"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  tel: "Phone",
  number: "Number",
  date: "Date",
  select: "Choice",
  checkbox: "Checkbox",
  file: "File upload",
  party: "Person (name, email, phone)",
};

export interface FormField {
  id: string;
  kind: "field";
  type: FieldType;
  /** Answer key. Mapped keys bind to columns on convert; others are custom. */
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** For type "select". */
  options?: string[];
}

export interface FormBlock {
  id: string;
  kind: "block";
  type: BlockType;
  text?: string;
}

export type FormCell = FormField | FormBlock;

export interface FormRow {
  id: string;
  /** One or two — a row never holds more (MAX_CELLS_PER_ROW). */
  cells: FormCell[];
}

export interface FormLayout {
  rows: FormRow[];
}

export const MAX_CELLS_PER_ROW = 2;

export function isField(cell: FormCell): cell is FormField {
  return cell.kind === "field";
}

/**
 * Keys that convert into real records. The `binds` note is what the reviewer
 * sees in the queue ("this becomes the property address"), and what stage 5's
 * converter switches on.
 */
export interface MappedField {
  key: string;
  label: string;
  type: FieldType;
  binds: string;
  options?: string[];
}

export const MAPPED_FIELDS: Record<FormKind, MappedField[]> = {
  client_intake: [
    { key: "clientName", label: "Name / office name", type: "text", binds: "Client name" },
    {
      key: "clientType",
      label: "Client type",
      type: "select",
      binds: "Client type",
      options: ["Individual agent", "Brokerage", "Team"],
    },
    { key: "email", label: "Email", type: "email", binds: "Client email" },
    { key: "phone", label: "Phone", type: "tel", binds: "Client phone" },
    { key: "address", label: "Address", type: "text", binds: "Client address" },
    { key: "brokerageName", label: "Brokerage name", type: "text", binds: "Their brokerage" },
    { key: "brokeragePhone", label: "Brokerage phone", type: "tel", binds: "Their brokerage" },
    { key: "brokerageAddress", label: "Brokerage address", type: "text", binds: "Their brokerage" },
    { key: "billingName", label: "Billing contact name", type: "text", binds: "Billing contact" },
    {
      key: "billingEmail",
      label: "Billing contact email",
      type: "email",
      binds: "Billing contact",
    },
    { key: "billingPhone", label: "Billing contact phone", type: "tel", binds: "Billing contact" },
  ],
  transaction_intake: [
    { key: "propertyAddress", label: "Property address", type: "text", binds: "Property address" },
    { key: "city", label: "City", type: "text", binds: "City" },
    { key: "state", label: "State", type: "text", binds: "State" },
    { key: "zip", label: "ZIP", type: "text", binds: "ZIP" },
    {
      key: "side",
      label: "Which side are you on?",
      type: "select",
      binds: "Transaction side",
      options: ["Buy side", "Sell side", "Dual (both sides)"],
    },
    { key: "purchasePrice", label: "Purchase price", type: "number", binds: "Purchase price" },
    { key: "contractDate", label: "Contract date", type: "date", binds: "Contract date" },
    { key: "closeDate", label: "Closing date", type: "date", binds: "Close date" },
    { key: "mlsId", label: "MLS ID", type: "text", binds: "MLS ID" },
    { key: "contractFile", label: "Signed contract", type: "file", binds: "Document on the file" },
    { key: "buyerAgent", label: "Buyer's agent", type: "party", binds: "Party — buyer's agent" },
    { key: "listingAgent", label: "Listing agent", type: "party", binds: "Party — listing agent" },
    { key: "attorney", label: "Attorney", type: "party", binds: "Party — attorney" },
    { key: "lender", label: "Lender", type: "party", binds: "Party — lender" },
    { key: "titleCompany", label: "Title company", type: "party", binds: "Party — title company" },
    { key: "notes", label: "Anything else we should know?", type: "textarea", binds: "File notes" },
  ],
};

export function mappedField(kind: FormKind, key: string): MappedField | null {
  return MAPPED_FIELDS[kind].find((f) => f.key === key) ?? null;
}

// --- parsing -------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function parseCell(raw: unknown): FormCell | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;

  if (o.kind === "block") {
    const type = BLOCK_TYPES.includes(o.type as BlockType) ? (o.type as BlockType) : null;
    if (!type) return null;
    return { id, kind: "block", type, ...(str(o.text) && { text: str(o.text) }) };
  }

  const type = FIELD_TYPES.includes(o.type as FieldType) ? (o.type as FieldType) : null;
  const key = str(o.key);
  const label = str(o.label);
  if (!type || !key || !label) return null;
  const options = Array.isArray(o.options)
    ? o.options.map((x) => str(x)).filter((x): x is string => Boolean(x))
    : undefined;
  return {
    id,
    kind: "field",
    type,
    key,
    label,
    ...(str(o.placeholder) && { placeholder: str(o.placeholder) }),
    ...(str(o.help) && { help: str(o.help) }),
    ...(o.required === true && { required: true }),
    ...(options && options.length > 0 && { options }),
  };
}

/**
 * Tolerant parse. A malformed layout reads as empty rather than throwing —
 * these render on public, unauthenticated pages, where a crash is worse than
 * a blank form.
 */
export function parseLayout(raw: unknown): FormLayout {
  if (raw == null || typeof raw !== "object") return { rows: [] };
  const rowsRaw = (raw as Record<string, unknown>).rows;
  if (!Array.isArray(rowsRaw)) return { rows: [] };

  const rows: FormRow[] = [];
  for (const r of rowsRaw) {
    if (r == null || typeof r !== "object" || Array.isArray(r)) continue;
    const ro = r as Record<string, unknown>;
    const id = str(ro.id);
    if (!id || !Array.isArray(ro.cells)) continue;
    const cells = ro.cells
      .map(parseCell)
      .filter((c): c is FormCell => c !== null)
      .slice(0, MAX_CELLS_PER_ROW);
    if (cells.length > 0) rows.push({ id, cells });
  }
  return normalizeLayout({ rows });
}

/**
 * Enforce the invariants the designer is supposed to maintain: at most two
 * cells per row, no empty rows, and no duplicate answer keys (a duplicate
 * would silently overwrite an answer, so later wins are renamed).
 */
export function normalizeLayout(layout: FormLayout): FormLayout {
  const seen = new Set<string>();
  const rows: FormRow[] = [];
  for (const row of layout.rows) {
    const cells = row.cells.slice(0, MAX_CELLS_PER_ROW).map((cell) => {
      if (!isField(cell)) return cell;
      let key = cell.key;
      let n = 2;
      while (seen.has(key)) key = `${cell.key}_${n++}`;
      seen.add(key);
      return key === cell.key ? cell : { ...cell, key };
    });
    if (cells.length > 0) rows.push({ ...row, cells });
  }
  return { rows };
}

export function emptyLayout(): FormLayout {
  return { rows: [] };
}

/** Every input in document order — the order a submission is read in. */
export function layoutFields(layout: FormLayout): FormField[] {
  return layout.rows.flatMap((r) => r.cells.filter(isField));
}

// --- validation ----------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A "party" answer: one cell, three values. */
export interface PartyValue {
  name?: string;
  email?: string;
  phone?: string;
}

export function parseParty(raw: unknown): PartyValue | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const p: PartyValue = {
    ...(str(o.name) && { name: str(o.name) }),
    ...(str(o.email) && { email: str(o.email) }),
    ...(str(o.phone) && { phone: str(o.phone) }),
  };
  return p.name || p.email || p.phone ? p : null;
}

/**
 * Field-level errors keyed by answer key. Empty object = the submission may
 * be stored. File fields are not checked here — uploads are handled by the
 * submit action, which enforces size and type limits of its own.
 */
export function validateSubmission(
  layout: FormLayout,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of layoutFields(layout)) {
    const raw = values[f.key];
    if (f.type === "file") continue;

    if (f.type === "party") {
      const party = parseParty(raw);
      if (f.required && !party?.name) errors[f.key] = `${f.label} needs at least a name.`;
      else if (party?.email && !EMAIL_RE.test(party.email))
        errors[f.key] = `That email doesn't look right.`;
      continue;
    }

    if (f.type === "checkbox") {
      if (f.required && raw !== true && raw !== "on") errors[f.key] = `${f.label} is required.`;
      continue;
    }

    const v = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
    if (v === "") {
      if (f.required) errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (f.type === "email" && !EMAIL_RE.test(v)) {
      errors[f.key] = `That email doesn't look right.`;
    } else if (f.type === "number" && !Number.isFinite(Number(v.replace(/[$,\s]/g, "")))) {
      errors[f.key] = `${f.label} should be a number.`;
    } else if (f.type === "date" && !DATE_RE.test(v)) {
      errors[f.key] = `${f.label} should be a date.`;
    } else if (f.type === "select" && f.options && f.options.length > 0 && !f.options.includes(v)) {
      errors[f.key] = `Pick one of the listed options.`;
    }
  }
  return errors;
}

/**
 * Who submitted this, for the review queue — read from whichever mapped
 * contact fields the TC happened to include, so the queue never has to parse
 * the whole answer set to show a name.
 */
export function submitterFrom(values: Record<string, unknown>): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = str(values[k]);
      if (v) return v;
    }
    return null;
  };
  // Falling back through the parties matters for transaction forms, which
  // often carry no plain contact field at all — without this the review
  // queue would list an unnamed submission nobody can triage. (The true
  // submitter, when they identified themselves by email, is set separately.)
  const parties = Object.values(values)
    .map(parseParty)
    .filter((p): p is PartyValue => p !== null);
  const fromParty = (k: keyof PartyValue) => parties.map((p) => p[k]).find(Boolean) ?? null;

  return {
    name: pick("clientName", "name", "fullName") ?? fromParty("name"),
    email: pick("email", "billingEmail", "contactEmail") ?? fromParty("email"),
    phone: pick("phone", "billingPhone", "contactPhone") ?? fromParty("phone"),
  };
}

// --- starter layouts -----------------------------------------------------

/** Build a field cell from its mapped definition, so defaults stay bound. */
function cellFor(kind: FormKind, key: string, overrides: Partial<FormField> = {}): FormField {
  const m = mappedField(kind, key);
  if (!m) throw new Error(`unknown mapped field ${kind}.${key}`);
  return {
    id: `c_${key}`,
    kind: "field",
    type: m.type,
    key: m.key,
    label: m.label,
    ...(m.options && { options: m.options }),
    ...overrides,
  };
}

function row(id: string, ...cells: FormCell[]): FormRow {
  return { id: `r_${id}`, cells: cells.slice(0, MAX_CELLS_PER_ROW) };
}

/**
 * What a new form starts as — a sensible, already-useful form rather than a
 * blank canvas, since most TCs will tweak rather than build from nothing.
 */
export function defaultLayout(kind: FormKind): FormLayout {
  if (kind === "client_intake") {
    return normalizeLayout({
      rows: [
        row("who", cellFor("client_intake", "clientName", { required: true })),
        row("type", cellFor("client_intake", "clientType", { required: true })),
        row(
          "contact",
          cellFor("client_intake", "email", { required: true }),
          cellFor("client_intake", "phone"),
        ),
        row("addr", cellFor("client_intake", "address")),
        row("brokerHead", {
          id: "b_broker",
          kind: "block",
          type: "heading",
          text: "Your brokerage",
        }),
        row(
          "broker",
          cellFor("client_intake", "brokerageName"),
          cellFor("client_intake", "brokeragePhone"),
        ),
        row("billHead", {
          id: "b_bill",
          kind: "block",
          type: "heading",
          text: "Who should we send invoices to?",
        }),
        row(
          "bill",
          cellFor("client_intake", "billingName"),
          cellFor("client_intake", "billingEmail"),
        ),
      ],
    });
  }
  return normalizeLayout({
    rows: [
      row("addr", cellFor("transaction_intake", "propertyAddress", { required: true })),
      row("city", cellFor("transaction_intake", "city"), cellFor("transaction_intake", "state")),
      row("side", cellFor("transaction_intake", "side", { required: true })),
      row(
        "dates",
        cellFor("transaction_intake", "contractDate"),
        cellFor("transaction_intake", "closeDate"),
      ),
      row("price", cellFor("transaction_intake", "purchasePrice")),
      row("contract", cellFor("transaction_intake", "contractFile")),
      row("partyHead", {
        id: "b_parties",
        kind: "block",
        type: "heading",
        text: "Who else is on this deal?",
      }),
      row(
        "agents",
        cellFor("transaction_intake", "buyerAgent"),
        cellFor("transaction_intake", "listingAgent"),
      ),
      row(
        "pros",
        cellFor("transaction_intake", "attorney"),
        cellFor("transaction_intake", "lender"),
      ),
      row("div", { id: "b_div", kind: "block", type: "divider" }),
      row("notes", cellFor("transaction_intake", "notes")),
    ],
  });
}

/** URL segment for a public form; collisions are resolved by the caller. */
export function slugifyFormName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "form";
}
