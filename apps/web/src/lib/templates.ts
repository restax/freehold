import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Merge-field template engine. Templates are plain text with {{tokens}};
 * a heading line starts with "# ". Rendering produces a simple, clean PDF
 * via pdf-lib (pure JS — no browser or native dependencies).
 */

export interface MergeContext {
  [key: string]: string;
}

interface TransactionLike {
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  purchasePrice: number | null;
  contractDate: Date | null;
  closeDate: Date | null;
  status: string;
  side: string;
  notes: string | null;
  customFields?: unknown;
  client?: { name: string; email: string | null; phone: string | null } | null;
  parties?: Array<{
    role: string;
    contact: { name: string; email: string | null; phone: string | null };
  }>;
}

const d = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : "");
const money = (n: number | null) => (n == null ? "" : `$${n.toLocaleString("en-US")}`);

export function buildMergeContext(
  txn: TransactionLike,
  tenantName: string,
  today = new Date(),
): MergeContext {
  const ctx: MergeContext = {
    "tenant.name": tenantName,
    today: d(today),
    "transaction.propertyAddress": txn.propertyAddress,
    "transaction.city": txn.city ?? "",
    "transaction.state": txn.state ?? "",
    "transaction.zip": txn.zip ?? "",
    "transaction.purchasePrice": money(txn.purchasePrice),
    "transaction.contractDate": d(txn.contractDate),
    "transaction.closeDate": d(txn.closeDate),
    "transaction.status": txn.status,
    "transaction.side": txn.side,
    "transaction.notes": txn.notes ?? "",
    "client.name": txn.client?.name ?? "",
    "client.email": txn.client?.email ?? "",
    "client.phone": txn.client?.phone ?? "",
  };
  for (const [k, v] of Object.entries((txn.customFields as Record<string, string> | null) ?? {})) {
    ctx[`custom.${k}`] = String(v);
  }
  for (const p of txn.parties ?? []) {
    if (!(`party.${p.role}.name` in ctx)) {
      ctx[`party.${p.role}.name`] = p.contact.name;
      ctx[`party.${p.role}.email`] = p.contact.email ?? "";
      ctx[`party.${p.role}.phone`] = p.contact.phone ?? "";
    }
  }
  return ctx;
}

export interface ResolvedTemplate {
  text: string;
  unknownKeys: string[];
}

/** Replace {{tokens}}; unknown tokens resolve to "" and are reported. */
export function resolveTemplate(body: string, ctx: MergeContext): ResolvedTemplate {
  const unknown = new Set<string>();
  const text = body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    if (key in ctx) return ctx[key] ?? "";
    unknown.add(key);
    return "";
  });
  return { text, unknownKeys: [...unknown] };
}

/** Common merge fields, surfaced in the template editor as a reference. */
export const MERGE_FIELD_REFERENCE = [
  "{{today}}",
  "{{tenant.name}}",
  "{{transaction.propertyAddress}}",
  "{{transaction.city}}",
  "{{transaction.state}}",
  "{{transaction.zip}}",
  "{{transaction.purchasePrice}}",
  "{{transaction.contractDate}}",
  "{{transaction.closeDate}}",
  "{{client.name}}",
  "{{client.email}}",
  "{{party.BUYER.name}}",
  "{{party.SELLER.name}}",
  "{{party.BUYER_AGENT.name}}",
  "{{party.LISTING_AGENT.name}}",
  "{{custom.<field name>}}",
];

const PAGE: [number, number] = [612, 792];
const MARGIN = 60;

export async function renderTemplatePdf(title: string, text: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE[0] - MARGIN * 2;

  let page = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const ensureRoom = (needed: number) => {
    if (y < MARGIN + needed) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };

  const wrap = (line: string, f: typeof font, size: number): string[] => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const probe = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(probe, size) > maxWidth && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = probe;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  ensureRoom(24);
  page.drawText(title.slice(0, 90), { x: MARGIN, y, size: 14, font: bold });
  y -= 26;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") {
      y -= 8;
      continue;
    }
    const isHeading = line.startsWith("# ");
    const content = isHeading ? line.slice(2) : line;
    const f = isHeading ? bold : font;
    const size = isHeading ? 12 : 11;
    if (isHeading) y -= 4;
    for (const seg of wrap(content, f, size)) {
      ensureRoom(16);
      page.drawText(seg, { x: MARGIN, y, size, font: f });
      y -= 15;
    }
  }

  return Buffer.from(await doc.save());
}
