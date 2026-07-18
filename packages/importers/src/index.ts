/**
 * Import framework: parse a CSV export from any TC platform, auto-map its
 * headers onto Freehold fields, and produce clean records ready to insert.
 *
 * Pure functions only — no database access here. The web app owns writes.
 */

/* ---------------------------------- CSV ---------------------------------- */

/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* -------------------------------- Mapping --------------------------------- */

export type ContactField = "name" | "email" | "phone" | "category";
export type TransactionField =
  | "propertyAddress"
  | "city"
  | "state"
  | "zip"
  | "status"
  | "side"
  | "purchasePrice"
  | "contractDate"
  | "closeDate"
  | "clientName";

/** Lowercased, punctuation-stripped header aliases per Freehold field. */
const CONTACT_ALIASES: Record<ContactField, string[]> = {
  name: ["name", "full name", "contact name", "contact", "first and last name"],
  email: ["email", "email address", "e mail", "primary email"],
  phone: ["phone", "phone number", "mobile", "cell", "primary phone", "mobile phone"],
  category: ["category", "type", "contact type", "role", "group", "tag"],
};

const TRANSACTION_ALIASES: Record<TransactionField, string[]> = {
  propertyAddress: [
    "property address",
    "address",
    "street address",
    "property",
    "full address",
    "address line 1",
  ],
  city: ["city", "property city"],
  state: ["state", "property state", "st"],
  zip: ["zip", "zip code", "postal code", "property zip"],
  status: ["status", "transaction status", "stage", "loop status", "pipeline status"],
  side: ["side", "representing", "transaction side", "client side", "buy sell"],
  purchasePrice: [
    "purchase price",
    "price",
    "sale price",
    "sales price",
    "contract price",
    "amount",
  ],
  contractDate: [
    "contract date",
    "effective date",
    "acceptance date",
    "contract agreement date",
    "under contract date",
    "executed date",
  ],
  closeDate: [
    "close date",
    "closing date",
    "close of escrow",
    "settlement date",
    "closing",
    "coe date",
  ],
  clientName: ["client", "client name", "agent", "agent name", "brokerage", "team"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map CSV headers onto known fields. Unmatched headers are reported, not dropped silently. */
export function mapHeaders<F extends string>(
  headers: string[],
  aliases: Record<F, string[]>,
): { mapping: Partial<Record<F, number>>; unmatched: string[] } {
  const mapping: Partial<Record<F, number>> = {};
  const unmatched: string[] = [];
  headers.forEach((header, index) => {
    const norm = normalizeHeader(header);
    const field = (Object.keys(aliases) as F[]).find(
      (f) => mapping[f] === undefined && aliases[f].some((a) => a === norm),
    );
    if (field) mapping[field] = index;
    else unmatched.push(header);
  });
  return { mapping, unmatched };
}

export function mapContactHeaders(headers: string[]) {
  return mapHeaders<ContactField>(headers, CONTACT_ALIASES);
}

export function mapTransactionHeaders(headers: string[]) {
  return mapHeaders<TransactionField>(headers, TRANSACTION_ALIASES);
}

/* ------------------------------ Value parsing ------------------------------ */

const STATUS_SYNONYMS: Record<string, string> = {
  listing: "LISTING",
  "active listing": "LISTING",
  active: "LISTING",
  "pre listing": "LISTING",
  "under contract": "UNDER_CONTRACT",
  "in contract": "UNDER_CONTRACT",
  contract: "UNDER_CONTRACT",
  "contract to close": "UNDER_CONTRACT",
  pending: "PENDING",
  "pending sale": "PENDING",
  escrow: "PENDING",
  "in escrow": "PENDING",
  closed: "CLOSED",
  sold: "CLOSED",
  settled: "CLOSED",
  complete: "CLOSED",
  completed: "CLOSED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  terminated: "CANCELLED",
  withdrawn: "CANCELLED",
  archived: "CANCELLED",
};

export function parseStatus(raw: string): string | null {
  return STATUS_SYNONYMS[normalizeHeader(raw)] ?? null;
}

const SIDE_SYNONYMS: Record<string, string> = {
  buy: "BUY_SIDE",
  buyer: "BUY_SIDE",
  "buy side": "BUY_SIDE",
  buying: "BUY_SIDE",
  purchase: "BUY_SIDE",
  sell: "SELL_SIDE",
  seller: "SELL_SIDE",
  "sell side": "SELL_SIDE",
  listing: "SELL_SIDE",
  selling: "SELL_SIDE",
  dual: "DUAL",
  both: "DUAL",
  "dual agency": "DUAL",
};

export function parseSide(raw: string): string | null {
  return SIDE_SYNONYMS[normalizeHeader(raw)] ?? null;
}

/** "$385,000.00" | "385000" | "385,000" → integer dollars, else null. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** "2026-08-14" | "8/14/2026" | "08-14-26" | "Aug 14, 2026" → ISO date string, else null. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const mo = m[1] ?? "";
    const day = m[2] ?? "";
    const yr = m[3] ?? "";
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${mo.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/* ------------------------------ Row → record ------------------------------ */

export interface ContactRecord {
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
}

export interface TransactionRecord {
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  side: string;
  purchasePrice: number | null;
  contractDate: string | null;
  closeDate: string | null;
  clientName: string | null;
}

export interface RowIssue {
  row: number;
  problem: string;
}

function cell(row: string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").trim();
}

export function buildContacts(rows: string[][]): {
  records: ContactRecord[];
  issues: RowIssue[];
  mapping: ReturnType<typeof mapContactHeaders>;
} {
  const [headers, ...data] = rows;
  const mapping = mapContactHeaders(headers ?? []);
  const { mapping: m } = mapping;
  const records: ContactRecord[] = [];
  const issues: RowIssue[] = [];
  data.forEach((row, i) => {
    const name = cell(row, m.name);
    if (!name) {
      issues.push({ row: i + 2, problem: "missing name; row skipped" });
      return;
    }
    records.push({
      name,
      email: cell(row, m.email) || null,
      phone: cell(row, m.phone) || null,
      category: cell(row, m.category) || null,
    });
  });
  return { records, issues, mapping };
}

export function buildTransactions(rows: string[][]): {
  records: TransactionRecord[];
  issues: RowIssue[];
  mapping: ReturnType<typeof mapTransactionHeaders>;
} {
  const [headers, ...data] = rows;
  const mapping = mapTransactionHeaders(headers ?? []);
  const { mapping: m } = mapping;
  const records: TransactionRecord[] = [];
  const issues: RowIssue[] = [];
  data.forEach((row, i) => {
    const rowNo = i + 2;
    const propertyAddress = cell(row, m.propertyAddress);
    if (!propertyAddress) {
      issues.push({ row: rowNo, problem: "missing property address; row skipped" });
      return;
    }
    const rawStatus = cell(row, m.status);
    const status = rawStatus ? parseStatus(rawStatus) : "UNDER_CONTRACT";
    if (status === null) {
      issues.push({
        row: rowNo,
        problem: `unrecognized status "${rawStatus}"; defaulted to Under contract`,
      });
    }
    const rawSide = cell(row, m.side);
    const side = rawSide ? parseSide(rawSide) : "BUY_SIDE";
    if (side === null) {
      issues.push({ row: rowNo, problem: `unrecognized side "${rawSide}"; defaulted to Buy side` });
    }
    const rawPrice = cell(row, m.purchasePrice);
    const purchasePrice = rawPrice ? parseMoney(rawPrice) : null;
    if (rawPrice && purchasePrice === null) {
      issues.push({ row: rowNo, problem: `unreadable price "${rawPrice}"; left empty` });
    }
    const rawContract = cell(row, m.contractDate);
    const contractDate = rawContract ? parseDate(rawContract) : null;
    if (rawContract && contractDate === null) {
      issues.push({ row: rowNo, problem: `unreadable contract date "${rawContract}"; left empty` });
    }
    const rawClose = cell(row, m.closeDate);
    const closeDate = rawClose ? parseDate(rawClose) : null;
    if (rawClose && closeDate === null) {
      issues.push({ row: rowNo, problem: `unreadable close date "${rawClose}"; left empty` });
    }
    records.push({
      propertyAddress,
      city: cell(row, m.city) || null,
      state: cell(row, m.state).toUpperCase() || null,
      zip: cell(row, m.zip) || null,
      status: status ?? "UNDER_CONTRACT",
      side: side ?? "BUY_SIDE",
      purchasePrice,
      contractDate,
      closeDate,
      clientName: cell(row, m.clientName) || null,
    });
  });
  return { records, issues, mapping };
}
