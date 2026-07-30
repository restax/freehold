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

export type ContactField =
  | "name"
  | "category"
  | "company"
  | "personTitle"
  | "firstName"
  | "middleName"
  | "lastName"
  | "jobTitle"
  | "phoneHome"
  | "phoneHomeExt"
  | "phoneCell"
  | "phoneCellExt"
  | "phoneWork"
  | "phoneWorkExt"
  | "phoneOther"
  | "phoneOtherExt"
  | "fax"
  | "faxExt"
  | "email"
  | "email2"
  | "email3"
  | "secondaryTitle"
  | "secondaryFirstName"
  | "secondaryMiddleName"
  | "secondaryLastName"
  | "secondaryJobTitle"
  | "secondaryHome"
  | "secondaryHomeExt"
  | "secondaryCell"
  | "secondaryCellExt"
  | "secondaryWork"
  | "secondaryWorkExt"
  | "secondaryEmail"
  | "secondaryEmail2"
  | "secondaryEmail3"
  | "homeAddress1"
  | "homeAddress2"
  | "homeCity"
  | "homeState"
  | "homeZip"
  | "workAddress1"
  | "workAddress2"
  | "workCity"
  | "workState"
  | "workZip"
  | "website"
  | "birthday"
  | "birthdayAlt"
  | "anniversary"
  | "anniversaryPurchase"
  | "categories"
  | "rating"
  | "referralSource"
  | "notes";
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

/**
 * Lowercased, punctuation-stripped header aliases per Freehold field.
 *
 * Covers two shapes at once: a plain single-column export (name/email/phone/
 * category — the long tail of "just a spreadsheet") and a full dual-person
 * CRM export in the style of A-Frame's contact template (first/last name,
 * a second household member, home and work addresses, multiple phones and
 * emails, touch dates, a relationship grade). A column that isn't recognized
 * is reported, never guessed at.
 */
const CONTACT_ALIASES: Record<ContactField, string[]> = {
  name: ["name", "full name", "contact name", "contact", "first and last name"],
  category: ["category", "type", "contact type", "role", "group", "tag"],
  company: ["company", "brokerage", "company name", "organization"],
  personTitle: ["title", "prefix", "salutation", "personal title"],
  firstName: ["first name", "firstname", "given name"],
  middleName: ["middle name", "middlename"],
  lastName: ["last name", "lastname", "surname", "family name"],
  jobTitle: ["job title", "position", "occupation"],
  phoneHome: ["phone home", "home phone", "home telephone"],
  phoneHomeExt: ["phone home ext", "home phone ext"],
  phoneCell: [
    "phone cell",
    "cell",
    "cell phone",
    "mobile",
    "mobile phone",
    "phone",
    "phone number",
    "primary phone",
  ],
  phoneCellExt: ["phone cell ext", "cell ext", "mobile ext"],
  phoneWork: ["phone work", "work phone", "office phone", "business phone"],
  phoneWorkExt: ["phone work ext", "work phone ext", "work ext"],
  phoneOther: ["phone other", "other phone", "alternate phone"],
  phoneOtherExt: ["phone other ext", "other phone ext"],
  fax: ["fax", "fax number"],
  faxExt: ["fax ext"],
  email: ["email", "email1", "email address", "e mail", "primary email"],
  email2: ["email2", "email 2", "secondary email address", "alternate email"],
  email3: ["email3", "email 3"],
  secondaryTitle: ["altcontact partner title", "spouse title", "partner title"],
  secondaryFirstName: [
    "altcontact partner first name",
    "spouse first name",
    "partner first name",
    "co first name",
  ],
  secondaryMiddleName: ["altcontact partner middle name", "spouse middle name"],
  secondaryLastName: [
    "altcontact partner last name",
    "spouse last name",
    "partner last name",
    "co last name",
  ],
  secondaryJobTitle: ["altcontact partner job title", "spouse job title", "partner job title"],
  secondaryHome: ["altcontact partner home", "spouse home phone", "partner home phone"],
  secondaryHomeExt: ["altcontact partner home ext"],
  secondaryCell: ["altcontact partner cell", "spouse cell", "partner cell", "co cell"],
  secondaryCellExt: ["altcontact partner cell ext"],
  secondaryWork: ["altcontact partner work", "spouse work phone", "partner work phone"],
  secondaryWorkExt: ["altcontact partner work ext"],
  secondaryEmail: [
    "altcontact email1",
    "spouse email",
    "partner email",
    "co email",
    "altcontact partner email",
  ],
  secondaryEmail2: ["altcontact email2"],
  secondaryEmail3: ["altcontact email3"],
  homeAddress1: ["home address", "home address 1", "home street address"],
  homeAddress2: ["home address 2", "home address line 2", "home apt suite"],
  homeCity: ["home city"],
  homeState: ["home state"],
  homeZip: ["home zip", "home zip code", "home postal code"],
  workAddress1: ["work address", "work address 1", "work street address"],
  workAddress2: ["work address 2", "work address line 2", "work apt suite"],
  workCity: ["work city"],
  workState: ["work state"],
  workZip: ["work zip", "work zip code", "work postal code"],
  website: ["website", "web site", "url"],
  birthday: ["birthday", "birth date", "date of birth"],
  birthdayAlt: ["birthdayaltcontact", "spouse birthday", "partner birthday"],
  anniversary: ["anniversary", "wedding anniversary"],
  anniversaryPurchase: ["anniversarypurchase", "purchase anniversary", "closing anniversary"],
  categories: ["categories", "tags", "groups"],
  rating: ["relationshiprating", "relationship rating", "rating", "grade"],
  referralSource: ["contactreferralsource", "referral source", "lead source", "source"],
  notes: ["notes", "note", "comments", "description"],
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
  listing: "ACTIVE",
  "active listing": "ACTIVE",
  active: "ACTIVE",
  "on market": "ACTIVE",
  // The other system's wording for the same lifecycle stages. Imports come
  // from whatever the coordinator was using before, so the spellings matter
  // more here than anywhere else.
  "coming soon": "COMING_SOON",
  "pre listing": "COMING_SOON",
  "pre-listing": "COMING_SOON",
  draft: "DRAFT",
  "temporarily off market": "TMP_OFF_MARKET",
  "temp off market": "TMP_OFF_MARKET",
  "tmp off market": "TMP_OFF_MARKET",
  "off market": "TMP_OFF_MARKET",
  hold: "TMP_OFF_MARKET",
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

export interface MonthDayValue {
  m: number;
  d: number;
  y?: number;
}

/** "1/1/1970" → {m:1,d:1,y:1970}. A touch date without a year is rare in an
 *  export, but the shape supports it (a birth year nobody recorded), so a
 *  bare "m/d" is accepted too. */
export function parseMonthDay(raw: string): MonthDayValue | undefined {
  const s = raw.trim();
  if (s === "") return undefined;
  const full = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (full) {
    const mo = Number(full[1]);
    const day = Number(full[2]);
    const yrRaw = full[3] ?? "";
    const y = Number(yrRaw.length === 2 ? `20${yrRaw}` : yrRaw);
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return { m: mo, d: day, y };
    return undefined;
  }
  const bare = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (bare) {
    const mo = Number(bare[1]);
    const day = Number(bare[2]);
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) return { m: mo, d: day };
  }
  return undefined;
}

/** "Sphere, Quarterly Newsletter, Builder" → ["Sphere", "Quarterly Newsletter", "Builder"].
 *  Splits on comma or semicolon — different exports separate a category list differently. */
export function splitCategories(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

export interface ImportedNote {
  date: string | null;
  body: string;
}

/**
 * A-Frame packs an unbounded number of dated notes into one cell: entries
 * separated by " ---- ", each optionally starting with "m/d/yyyy|" before
 * the note text. Only the *first* "|" in an entry is the date separator —
 * the note body itself is free text and may contain more of them (the
 * sample export's own instructions do), so this deliberately doesn't split
 * on every pipe.
 */
export function parseNotes(raw: string): ImportedNote[] {
  const s = raw.trim();
  if (s === "") return [];
  return s
    .split(" ---- ")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = chunk.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\|([\s\S]*)$/);
      if (m?.[1] && m[2] !== undefined) {
        const date = parseDate(m[1]);
        return { date, body: m[2].trim() };
      }
      return { date: null, body: chunk };
    })
    .filter((n) => n.body !== "");
}

/** "214-555-9999" + "His Home Line" → "214-555-9999 (His Home Line)". An
 *  extension has nowhere else to live once it's folded into a plain string
 *  field, so it travels with the number rather than being dropped. */
function withExt(phone: string, ext: string): string | null {
  if (!phone) return null;
  return ext ? `${phone} (${ext})` : phone;
}

/* ------------------------------ Row → record ------------------------------ */

export interface ContactPersonRecord {
  title?: string;
  first?: string;
  middle?: string;
  last?: string;
  jobTitle?: string;
  cell?: string;
  workPhone?: string;
  email?: string;
}

export interface ContactAddressRecord {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface ContactTouchDates {
  birthday?: MonthDayValue;
  birthdayAlt?: MonthDayValue;
  weddingAnniversary?: MonthDayValue;
  purchaseAnniversary?: MonthDayValue;
}

export interface ContactRecord {
  name: string;
  email: string | null;
  phone: string | null;
  workPhone: string | null;
  fax: string | null;
  category: string | null;
  categories: string[];
  personTitle: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  company: string | null;
  website: string | null;
  grade: string | null;
  referralSource: string | null;
  secondary: ContactPersonRecord | null;
  extraContacts: { phones: string[]; emails: string[] } | null;
  homeAddress: ContactAddressRecord | null;
  workAddress: ContactAddressRecord | null;
  touchDates: ContactTouchDates | null;
  notes: ImportedNote[];
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

const GRADE_VALUES = new Set(["A", "B", "C", "D"]);

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
    const rowNo = i + 2;
    const firstName = cell(row, m.firstName) || null;
    const lastName = cell(row, m.lastName) || null;
    const rawName = cell(row, m.name);
    const company = cell(row, m.company) || null;
    const structuredName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const name = structuredName || rawName || company;
    if (!name) {
      issues.push({ row: rowNo, problem: "missing name; row skipped" });
      return;
    }

    const phone = withExt(cell(row, m.phoneCell), cell(row, m.phoneCellExt));
    const workPhone = withExt(cell(row, m.phoneWork), cell(row, m.phoneWorkExt));
    const fax = withExt(cell(row, m.fax), cell(row, m.faxExt));

    const extraPhones = [
      withExt(cell(row, m.phoneHome), cell(row, m.phoneHomeExt)),
      withExt(cell(row, m.phoneOther), cell(row, m.phoneOtherExt)),
      withExt(cell(row, m.secondaryHome), cell(row, m.secondaryHomeExt)),
    ].filter((v): v is string => Boolean(v));
    const extraEmails = [
      cell(row, m.email2),
      cell(row, m.email3),
      cell(row, m.secondaryEmail2),
      cell(row, m.secondaryEmail3),
    ].filter(Boolean);

    const secondaryFirst = cell(row, m.secondaryFirstName) || null;
    const secondaryLast = cell(row, m.secondaryLastName) || null;
    const secondaryCell = withExt(cell(row, m.secondaryCell), cell(row, m.secondaryCellExt));
    const secondaryWork = withExt(cell(row, m.secondaryWork), cell(row, m.secondaryWorkExt));
    const secondaryEmail = cell(row, m.secondaryEmail) || undefined;
    const secondary: ContactPersonRecord | null =
      secondaryFirst || secondaryLast || secondaryCell || secondaryWork || secondaryEmail
        ? {
            title: cell(row, m.secondaryTitle) || undefined,
            first: secondaryFirst ?? undefined,
            middle: cell(row, m.secondaryMiddleName) || undefined,
            last: secondaryLast ?? undefined,
            jobTitle: cell(row, m.secondaryJobTitle) || undefined,
            cell: secondaryCell ?? undefined,
            workPhone: secondaryWork ?? undefined,
            email: secondaryEmail,
          }
        : null;

    const homeAddr: ContactAddressRecord = {
      line1: cell(row, m.homeAddress1) || undefined,
      line2: cell(row, m.homeAddress2) || undefined,
      city: cell(row, m.homeCity) || undefined,
      state: cell(row, m.homeState) || undefined,
      zip: cell(row, m.homeZip) || undefined,
    };
    const workAddr: ContactAddressRecord = {
      line1: cell(row, m.workAddress1) || undefined,
      line2: cell(row, m.workAddress2) || undefined,
      city: cell(row, m.workCity) || undefined,
      state: cell(row, m.workState) || undefined,
      zip: cell(row, m.workZip) || undefined,
    };

    const touchDates: ContactTouchDates = {
      birthday: parseMonthDay(cell(row, m.birthday)),
      birthdayAlt: parseMonthDay(cell(row, m.birthdayAlt)),
      weddingAnniversary: parseMonthDay(cell(row, m.anniversary)),
      purchaseAnniversary: parseMonthDay(cell(row, m.anniversaryPurchase)),
    };

    const categories = [
      ...splitCategories(cell(row, m.categories)),
      ...splitCategories(cell(row, m.category)),
    ].filter((c, idx, arr) => arr.indexOf(c) === idx);

    const rawRating = cell(row, m.rating);
    const grade = rawRating ? rawRating.trim().toUpperCase() : "";
    if (rawRating && !GRADE_VALUES.has(grade)) {
      issues.push({
        row: rowNo,
        problem: `unrecognized relationship rating "${rawRating}"; left empty`,
      });
    }

    records.push({
      name,
      email: cell(row, m.email) || null,
      phone,
      workPhone,
      fax,
      category: categories[0] ?? null,
      categories,
      personTitle: cell(row, m.personTitle) || null,
      firstName,
      middleName: cell(row, m.middleName) || null,
      lastName,
      jobTitle: cell(row, m.jobTitle) || null,
      company,
      website: cell(row, m.website) || null,
      grade: GRADE_VALUES.has(grade) ? grade : null,
      referralSource: cell(row, m.referralSource) || null,
      secondary,
      extraContacts:
        extraPhones.length || extraEmails.length
          ? { phones: extraPhones, emails: extraEmails }
          : null,
      homeAddress: Object.values(homeAddr).some(Boolean) ? homeAddr : null,
      workAddress: Object.values(workAddr).some(Boolean) ? workAddr : null,
      touchDates: Object.values(touchDates).some(Boolean) ? touchDates : null,
      notes: parseNotes(cell(row, m.notes)),
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
