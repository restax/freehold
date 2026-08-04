import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

/**
 * Generated paperwork for the demo dataset: purchase agreements and MLS
 * listing sheets, filled from each transaction's own address, price and
 * parties so no two files look alike on screen.
 *
 * Every page carries a "SAMPLE" footer. These are fabricated documents that
 * deliberately look like the real thing, and a plausible-looking contract with
 * no marking on it is the kind of artifact that ends up somewhere it
 * shouldn't. The marking is small enough not to spoil a screen recording.
 */

const LETTER: [number, number] = [612, 792];

const INK = rgb(0x1c / 255, 0x19 / 255, 0x17 / 255);
const MUTED = rgb(0x57 / 255, 0x53 / 255, 0x4e / 255);
const FAINT = rgb(0xa8 / 255, 0xa2 / 255, 0x9e / 255);
const LINE = rgb(0xd6 / 255, 0xd3 / 255, 0xd1 / 255);
const BAND = rgb(0xf5 / 255, 0xf5 / 255, 0xf4 / 255);
const MOSS = rgb(0x4a / 255, 0x5d / 255, 0x3a / 255);
const WHITE = rgb(1, 1, 1);

const MARGIN = 54;
const CONTENT_WIDTH = LETTER[0] - MARGIN * 2;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** Greedy wrap. pdf-lib's own maxWidth exists but does not report height back. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Small stateful cursor so sections can just say "write this next". */
class Cursor {
  y: number;
  constructor(
    public page: PDFPage,
    startY: number,
  ) {
    this.y = startY;
  }
  space(n: number) {
    this.y -= n;
  }
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  label: string,
  pageNo: number,
  total: number,
  kind: "agreement" | "listing",
) {
  page.drawLine({
    start: { x: MARGIN, y: 52 },
    end: { x: LETTER[0] - MARGIN, y: 52 },
    thickness: 0.5,
    color: LINE,
  });
  const disclaimer =
    kind === "agreement"
      ? "SAMPLE - demonstration data, not a real agreement"
      : "SAMPLE - demonstration data, not a real listing";
  page.drawText(disclaimer, {
    x: MARGIN,
    y: 38,
    size: 7.5,
    font,
    color: FAINT,
  });
  const right = `${label}   Page ${pageNo} of ${total}`;
  page.drawText(right, {
    x: LETTER[0] - MARGIN - font.widthOfTextAtSize(right, 7.5),
    y: 38,
    size: 7.5,
    font,
    color: FAINT,
  });
}

export interface ContractPdfInput {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  buyerName: string;
  sellerName: string;
  buyerAgentName?: string;
  sellerAgentName?: string;
  lenderName?: string;
  titleName?: string;
  contractDate: Date;
  closeDate: Date;
  /** 0-3, picks one of four form styles so the files are not identical. */
  variant: number;
}

/** Four fictional form families, so the library does not look copy-pasted. */
const FORM_VARIANTS = [
  {
    board: "Tennessee Residential Property Association",
    code: "TRPA Form 201",
    title: "RESIDENTIAL PURCHASE AND SALE AGREEMENT",
    earnestPct: 0.01,
    inspectionDays: 10,
    financingDays: 21,
  },
  {
    board: "Middle Tennessee Board of Realtors",
    code: "MTBR Form RF-401",
    title: "PURCHASE AND SALE AGREEMENT - RESIDENTIAL",
    earnestPct: 0.015,
    inspectionDays: 14,
    financingDays: 25,
  },
  {
    board: "Cumberland Valley Realty Association",
    code: "CVRA Contract 1010",
    title: "AGREEMENT OF PURCHASE AND SALE",
    earnestPct: 0.02,
    inspectionDays: 7,
    financingDays: 18,
  },
  {
    board: "Statewide Realty Forms Committee",
    code: "SRFC Form 88-R",
    title: "RESIDENTIAL REAL ESTATE PURCHASE CONTRACT",
    earnestPct: 0.0125,
    inspectionDays: 12,
    financingDays: 23,
  },
] as const;

export async function purchaseAgreementPdf(input: ContractPdfInput): Promise<Uint8Array> {
  const form = FORM_VARIANTS[input.variant % FORM_VARIANTS.length];
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const fullAddress = `${input.address}, ${input.city}, ${input.state} ${input.zip}`;
  const earnest = Math.round((input.price * form.earnestPct) / 100) * 100;
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  const page1 = doc.addPage(LETTER);
  const c = new Cursor(page1, 792 - MARGIN);

  // --- Masthead ---
  page1.drawRectangle({ x: 0, y: c.y - 6, width: LETTER[0], height: 62, color: BAND });
  page1.drawText(form.board.toUpperCase(), {
    x: MARGIN,
    y: c.y + 30,
    size: 8,
    font: bold,
    color: MOSS,
  });
  page1.drawText(form.title, { x: MARGIN, y: c.y + 12, size: 14, font: bold, color: INK });
  page1.drawText(form.code, { x: MARGIN, y: c.y - 1, size: 8, font, color: MUTED });
  c.space(58);

  const section = (n: number, heading: string) => {
    c.space(4);
    page1.drawText(`${n}.`, { x: MARGIN, y: c.y, size: 9.5, font: bold, color: MOSS });
    page1.drawText(heading.toUpperCase(), {
      x: MARGIN + 16,
      y: c.y,
      size: 9.5,
      font: bold,
      color: INK,
    });
    c.space(15);
  };

  const body = (text: string) => {
    for (const line of wrap(text, font, 9, CONTENT_WIDTH - 16)) {
      page1.drawText(line, { x: MARGIN + 16, y: c.y, size: 9, font, color: INK });
      c.space(12.5);
    }
    c.space(3);
  };

  /** Label on the left, filled value on a ruled line to the right. */
  const field = (label: string, value: string) => {
    page1.drawText(label, { x: MARGIN + 16, y: c.y, size: 9, font, color: MUTED });
    const x = MARGIN + 165;
    page1.drawText(value, { x, y: c.y, size: 9.5, font: bold, color: INK });
    page1.drawLine({
      start: { x: x - 4, y: c.y - 4 },
      end: { x: LETTER[0] - MARGIN, y: c.y - 4 },
      thickness: 0.5,
      color: LINE,
    });
    c.space(19);
  };

  section(1, "Parties");
  field("Buyer", input.buyerName);
  field("Seller", input.sellerName);

  section(2, "Property");
  field("Address", input.address);
  field("City, state, ZIP", `${input.city}, ${input.state} ${input.zip}`);
  body(
    "Together with all improvements, fixtures, and appurtenances now located on the property, excluding only items expressly reserved by Seller in writing.",
  );

  section(3, "Purchase price and earnest money");
  field("Purchase price", money(input.price));
  field("Earnest money", money(earnest));
  body(
    `Earnest money shall be deposited with ${input.titleName ?? "the closing agent"} within three (3) business days of the Effective Date and credited to Buyer at closing.`,
  );

  section(4, "Financing");
  field("Lender", input.lenderName ?? "To be identified by Buyer");
  field("Financing deadline", longDate(addDays(input.contractDate, form.financingDays)));
  body(
    `This Agreement is contingent upon Buyer obtaining a loan commitment on or before the financing deadline stated above. Buyer shall apply within five (5) days of the Effective Date and pursue approval in good faith.`,
  );

  section(5, "Inspection and due diligence");
  field("Inspection deadline", longDate(addDays(input.contractDate, form.inspectionDays)));
  body(
    `Buyer shall have ${form.inspectionDays} days from the Effective Date to inspect the property at Buyer's expense and to deliver written notice of any items Buyer requests be repaired. If Buyer delivers no notice within that period, this contingency is waived.`,
  );

  section(6, "Closing");
  field("Effective date", longDate(input.contractDate));
  field("Closing date", longDate(input.closeDate));
  field("Closing agent", input.titleName ?? "To be designated");

  drawFooter(page1, font, form.code, 1, 2, "agreement");

  // ---------------- Page two ----------------
  const page2 = doc.addPage(LETTER);
  const c2 = new Cursor(page2, 792 - MARGIN);
  page2.drawText(`${form.title} (continued)`, {
    x: MARGIN,
    y: c2.y,
    size: 10,
    font: bold,
    color: INK,
  });
  page2.drawText(fullAddress, { x: MARGIN, y: c2.y - 14, size: 8.5, font, color: MUTED });
  c2.space(38);

  const section2 = (n: number, heading: string) => {
    c2.space(4);
    page2.drawText(`${n}.`, { x: MARGIN, y: c2.y, size: 9.5, font: bold, color: MOSS });
    page2.drawText(heading.toUpperCase(), {
      x: MARGIN + 16,
      y: c2.y,
      size: 9.5,
      font: bold,
      color: INK,
    });
    c2.space(15);
  };
  const body2 = (text: string) => {
    for (const line of wrap(text, font, 9, CONTENT_WIDTH - 16)) {
      page2.drawText(line, { x: MARGIN + 16, y: c2.y, size: 9, font, color: INK });
      c2.space(12.5);
    }
    c2.space(3);
  };

  section2(7, "Title and survey");
  body2(
    "Seller shall convey marketable title by general warranty deed, free of liens except those of record accepted by Buyer. Buyer may obtain a survey at Buyer's expense and shall notify Seller of any material encroachment within ten (10) days of receipt.",
  );

  section2(8, "Prorations");
  body2(
    "Real property taxes, association dues, and any prepaid utilities shall be prorated as of the closing date. Special assessments certified before closing shall be paid by Seller.",
  );

  section2(9, "Default and remedies");
  body2(
    "If Buyer fails to perform, Seller may retain the earnest money as liquidated damages. If Seller fails to perform, Buyer may recover the earnest money and pursue any remedy available at law or in equity.",
  );

  section2(10, "Brokerage");
  body2(
    `Listing firm: ${input.sellerAgentName ?? "Not represented"}. Selling firm: ${input.buyerAgentName ?? "Not represented"}. Compensation is governed by separate written agreement and is not a term of this contract.`,
  );

  section2(11, "Additional provisions");
  body2(
    "Seller shall deliver the property in substantially the same condition as on the Effective Date, ordinary wear excepted, and shall leave all remotes, keys, and access codes at closing. Time is of the essence.",
  );

  // --- Signature block ---
  c2.space(16);
  page2.drawLine({
    start: { x: MARGIN, y: c2.y + 6 },
    end: { x: LETTER[0] - MARGIN, y: c2.y + 6 },
    thickness: 0.5,
    color: LINE,
  });
  c2.space(14);
  page2.drawText("SIGNATURES", { x: MARGIN, y: c2.y, size: 9.5, font: bold, color: INK });
  c2.space(30);

  const signature = (role: string, name: string, x: number) => {
    const w = (CONTENT_WIDTH - 30) / 2;
    page2.drawLine({
      start: { x, y: c2.y },
      end: { x: x + w, y: c2.y },
      thickness: 0.75,
      color: INK,
    });
    page2.drawText(name, { x, y: c2.y - 12, size: 9, font: bold, color: INK });
    page2.drawText(role, { x, y: c2.y - 24, size: 8, font, color: MUTED });
    page2.drawLine({
      start: { x, y: c2.y - 44 },
      end: { x: x + w * 0.55, y: c2.y - 44 },
      thickness: 0.75,
      color: INK,
    });
    page2.drawText("Date", { x, y: c2.y - 56, size: 8, font, color: MUTED });
  };

  signature("Buyer", input.buyerName, MARGIN);
  signature("Seller", input.sellerName, MARGIN + (CONTENT_WIDTH - 30) / 2 + 30);

  drawFooter(page2, font, form.code, 2, 2, "agreement");

  return doc.save();
}

export interface MlsPdfInput {
  mlsNumber: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotAcres: number;
  remarks: string;
  listingAgentName?: string;
  listingOfficeName?: string;
}

export async function mlsSheetPdf(input: MlsPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(LETTER);

  // --- Header band ---
  page.drawRectangle({ x: 0, y: 792 - 92, width: LETTER[0], height: 92, color: MOSS });
  page.drawText("MIDDLE TENNESSEE MLS", {
    x: MARGIN,
    y: 792 - 34,
    size: 9,
    font: bold,
    color: rgb(0.85, 0.89, 0.82),
  });
  page.drawText(input.address, { x: MARGIN, y: 792 - 60, size: 17, font: bold, color: WHITE });
  page.drawText(`${input.city}, ${input.state} ${input.zip}`, {
    x: MARGIN,
    y: 792 - 78,
    size: 10,
    font,
    color: rgb(0.85, 0.89, 0.82),
  });

  const priceText = money(input.price);
  page.drawText(priceText, {
    x: LETTER[0] - MARGIN - bold.widthOfTextAtSize(priceText, 20),
    y: 792 - 62,
    size: 20,
    font: bold,
    color: WHITE,
  });
  const statusText = `MLS# ${input.mlsNumber}  ·  ${input.status}`;
  page.drawText(statusText, {
    x: LETTER[0] - MARGIN - font.widthOfTextAtSize(statusText, 9),
    y: 792 - 78,
    size: 9,
    font,
    color: rgb(0.85, 0.89, 0.82),
  });

  let y = 792 - 130;

  // --- Photo placeholder. A demo shot with a broken image box looks worse
  //     than an honest "photo not included" panel. ---
  page.drawRectangle({
    x: MARGIN,
    y: y - 168,
    width: CONTENT_WIDTH,
    height: 168,
    color: BAND,
    borderColor: LINE,
    borderWidth: 0.5,
  });
  const ph = "Listing photography not included in sample data";
  page.drawText(ph, {
    x: MARGIN + (CONTENT_WIDTH - font.widthOfTextAtSize(ph, 9)) / 2,
    y: y - 90,
    size: 9,
    font,
    color: FAINT,
  });
  y -= 196;

  // --- Stat grid ---
  const stats: Array<[string, string]> = [
    ["Bedrooms", String(input.beds)],
    ["Bathrooms", String(input.baths)],
    ["Square feet", input.sqft.toLocaleString("en-US")],
    ["Year built", String(input.yearBuilt)],
    ["Lot size", `${input.lotAcres.toFixed(2)} acres`],
    ["Price / sq ft", `$${Math.round(input.price / input.sqft)}`],
  ];
  const colW = CONTENT_WIDTH / 3;
  stats.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * colW;
    const rowY = y - row * 46;
    page.drawText(label.toUpperCase(), { x, y: rowY, size: 7.5, font, color: FAINT });
    page.drawText(value, { x, y: rowY - 16, size: 13, font: bold, color: INK });
  });
  y -= 46 * Math.ceil(stats.length / 3) + 14;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: LETTER[0] - MARGIN, y },
    thickness: 0.5,
    color: LINE,
  });
  y -= 24;

  // --- Remarks ---
  page.drawText("PUBLIC REMARKS", { x: MARGIN, y, size: 8, font: bold, color: MOSS });
  y -= 16;
  for (const line of wrap(input.remarks, font, 10, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y, size: 10, font, color: INK });
    y -= 14;
  }
  y -= 18;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: LETTER[0] - MARGIN, y },
    thickness: 0.5,
    color: LINE,
  });
  y -= 24;

  // --- Listing office ---
  page.drawText("LISTING OFFICE", { x: MARGIN, y, size: 8, font: bold, color: MOSS });
  y -= 16;
  page.drawText(input.listingAgentName ?? "Listing agent on file", {
    x: MARGIN,
    y,
    size: 10.5,
    font: bold,
    color: INK,
  });
  y -= 14;
  page.drawText(input.listingOfficeName ?? "Office on file", {
    x: MARGIN,
    y,
    size: 9.5,
    font,
    color: MUTED,
  });

  drawFooter(page, font, `MLS# ${input.mlsNumber}`, 1, 1, "listing");
  return doc.save();
}
