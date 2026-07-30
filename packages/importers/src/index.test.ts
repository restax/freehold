import { describe, expect, it } from "vitest";
import {
  buildContacts,
  buildTransactions,
  mapContactHeaders,
  mapTransactionHeaders,
  parseCsv,
  parseDate,
  parseMoney,
  parseMonthDay,
  parseNotes,
  parseSide,
  parseStatus,
  splitCategories,
} from "./index.js";

describe("parseCsv", () => {
  it("parses quoted fields with commas, escaped quotes, and CRLF", () => {
    const text = 'name,notes\r\n"Smith, Jane","She said ""hi""\nand left"\r\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Smith, Jane", 'She said "hi"\nand left'],
    ]);
  });

  it("strips BOM and drops empty trailing rows", () => {
    expect(parseCsv("﻿a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("header mapping", () => {
  it("maps vendor-flavored headers case-insensitively", () => {
    const { mapping, unmatched } = mapTransactionHeaders([
      "Property Address",
      "Closing Date",
      "Sales Price",
      "Loop Status",
      "Representing",
      "MLS #",
    ]);
    expect(mapping.propertyAddress).toBe(0);
    expect(mapping.closeDate).toBe(1);
    expect(mapping.purchasePrice).toBe(2);
    expect(mapping.status).toBe(3);
    expect(mapping.side).toBe(4);
    expect(unmatched).toEqual(["MLS #"]);
  });
});

describe("value parsing", () => {
  it("parses money with symbols and cents", () => {
    expect(parseMoney("$385,000.00")).toBe(385000);
    expect(parseMoney("412500")).toBe(412500);
    expect(parseMoney("n/a")).toBeNull();
  });

  it("parses common date shapes", () => {
    expect(parseDate("2026-08-14")).toBe("2026-08-14");
    expect(parseDate("8/14/2026")).toBe("2026-08-14");
    expect(parseDate("08-14-26")).toBe("2026-08-14");
    expect(parseDate("soon")).toBeNull();
  });

  it("maps status and side synonyms", () => {
    expect(parseStatus("In Escrow")).toBe("PENDING");
    expect(parseStatus("Sold")).toBe("CLOSED");
    expect(parseSide("Buyer")).toBe("BUY_SIDE");
    expect(parseSide("Listing")).toBe("SELL_SIDE");
  });
});

describe("buildContacts — simple single-column export", () => {
  it("builds records and reports skipped rows", () => {
    const rows = parseCsv(
      "Full Name,Email Address,Cell\nJane Smith,jane@x.com,312-555-0110\n,missing@x.com,\n",
    );
    const { records, issues } = buildContacts(rows);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      name: "Jane Smith",
      email: "jane@x.com",
      phone: "312-555-0110",
      category: null,
      categories: [],
    });
    expect(issues).toEqual([{ row: 3, problem: "missing name; row skipped" }]);
  });
});

describe("buildContacts — A-Frame-style dual-person export", () => {
  const HEADER =
    "Company,Title,First Name,Middle Name,Last Name,Job Title,Phone Home,Phone Home Ext,Phone Cell,Phone Cell Ext,Phone Work,Phone Work Ext,Phone Other,Phone Other Ext,Fax,Fax Ext,Email1,Email2,Email3,AltContact/Partner Title,AltContact/Partner First Name,AltContact/Partner Middle Name,AltContact/Partner Last Name,AltContact/Partner Job Title,AltContact/Partner Home,AltContact/Partner Home Ext,AltContact/Partner Cell,AltContact/Partner Cell Ext,AltContact/Partner Work,AltContact/Partner Work Ext,AltContact Email1,AltContact Email2,AltContact Email3,Home Address,Home Address 2,Home City,Home State,Home Zip,Work Address,Work Address 2,Work City,Work State,Work Zip,Website,Birthday,BirthdayAltContact,Anniversary,AnniversaryPurchase,Categories,RelationshipRating,ContactReferralSource,Notes";

  it("maps every A-Frame column onto a Freehold field", () => {
    const { mapping, unmatched } = mapContactHeaders(parseCsv(HEADER)[0] ?? []);
    expect(unmatched).toEqual([]);
    expect(Object.keys(mapping)).toHaveLength(52);
  });

  it("builds a fully-populated record from row 2 of the sample template", () => {
    const row =
      'ABC Realty,Mr. ,John,,Doe,,214-555-1234,,214-555-1111,,214-555-2222,,214-555-33333,Voice Mail,214-555-4444,,john@doe.com,john.doe@test.com,,Mrs. ,Jane,,Doe,,,,214-555-4567,,,,jane@doe.com,,,1234 Primrose Lane,,Dallas,Tx,75205,555 Main Street,5th Floor,Dallas,Tx,75205,www.JohnDoe.com,1/1/1970,1/1/1970,1/1/2000,1/1/2000,"Sphere, Quarterly Newsletter, Builder",A,Open House,Single note with no date';
    const { records, issues } = buildContacts(parseCsv(`${HEADER}\n${row}`));
    expect(issues).toEqual([]);
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r).toMatchObject({
      name: "John Doe",
      company: "ABC Realty",
      personTitle: "Mr.",
      firstName: "John",
      lastName: "Doe",
      phone: "214-555-1111",
      workPhone: "214-555-2222",
      fax: "214-555-4444",
      email: "john@doe.com",
      website: "www.JohnDoe.com",
      grade: "A",
      referralSource: "Open House",
      categories: ["Sphere", "Quarterly Newsletter", "Builder"],
      category: "Sphere",
    });
    expect(r?.extraContacts).toEqual({
      phones: ["214-555-1234", "214-555-33333 (Voice Mail)"],
      emails: ["john.doe@test.com"],
    });
    expect(r?.secondary).toEqual({
      title: "Mrs.",
      first: "Jane",
      last: "Doe",
      cell: "214-555-4567",
      email: "jane@doe.com",
    });
    expect(r?.homeAddress).toEqual({
      line1: "1234 Primrose Lane",
      city: "Dallas",
      state: "Tx",
      zip: "75205",
    });
    expect(r?.workAddress).toEqual({
      line1: "555 Main Street",
      line2: "5th Floor",
      city: "Dallas",
      state: "Tx",
      zip: "75205",
    });
    expect(r?.touchDates).toEqual({
      birthday: { m: 1, d: 1, y: 1970 },
      birthdayAlt: { m: 1, d: 1, y: 1970 },
      weddingAnniversary: { m: 1, d: 1, y: 2000 },
      purchaseAnniversary: { m: 1, d: 1, y: 2000 },
    });
    expect(r?.notes).toEqual([{ date: null, body: "Single note with no date" }]);
  });

  it("parses row 3's multi-dated notes, keeping the pipe inside a note body intact", () => {
    const row =
      ',Dr.,Richard,,Johnson,,214-555-9999,His Home Line,,,214-555-8888,Direct,,,,,richard@test.com,,,Mrs. ,Sally,,Johnson,,,,214-555-9874,,,,sally@test.com,,,5461 Brown Street,,Dallas,Tx,75205,111 Elm Street,,Dallas,Tx,75205,,,,,,Sphere,C,,"1/1/2023|You can import dates using this pattern: m/d/yyyy|note ---- 1/2/2023|Separate multiple notes with 4 dashes surrounded by spaces"';
    const { records } = buildContacts(parseCsv(`${HEADER}\n${row}`));
    expect(records[0]?.notes).toEqual([
      { date: "2023-01-01", body: "You can import dates using this pattern: m/d/yyyy|note" },
      { date: "2023-01-02", body: "Separate multiple notes with 4 dashes surrounded by spaces" },
    ]);
    expect(records[0]?.grade).toBe("C");
    expect(records[0]?.extraContacts?.phones).toEqual(["214-555-9999 (His Home Line)"]);
  });

  it("flags an unrecognized relationship rating rather than guessing", () => {
    const columnCount = (HEADER.match(/,/g)?.length ?? 0) + 1;
    const cells = new Array(columnCount).fill("");
    cells[2] = "Pat"; // First Name
    cells[4] = "Lee"; // Last Name
    cells[49] = "Z"; // RelationshipRating
    const { issues } = buildContacts(parseCsv(`${HEADER}\n${cells.join(",")}`));
    expect(issues.some((i) => i.problem.includes('unrecognized relationship rating "Z"'))).toBe(
      true,
    );
  });
});

describe("parseMonthDay", () => {
  it("parses a full m/d/yyyy date", () => {
    expect(parseMonthDay("1/1/1970")).toEqual({ m: 1, d: 1, y: 1970 });
  });
  it("parses a bare m/d with no year", () => {
    expect(parseMonthDay("12/25")).toEqual({ m: 12, d: 25 });
  });
  it("returns undefined for blank or unreadable input", () => {
    expect(parseMonthDay("")).toBeUndefined();
    expect(parseMonthDay("not a date")).toBeUndefined();
  });
});

describe("splitCategories", () => {
  it("splits on comma or semicolon and trims", () => {
    expect(splitCategories("Sphere, Quarterly Newsletter,Builder")).toEqual([
      "Sphere",
      "Quarterly Newsletter",
      "Builder",
    ]);
    expect(splitCategories("Vendor; Lender")).toEqual(["Vendor", "Lender"]);
  });
  it("returns an empty array for blank input", () => {
    expect(splitCategories("")).toEqual([]);
  });
});

describe("parseNotes", () => {
  it("returns an empty array for blank input", () => {
    expect(parseNotes("")).toEqual([]);
  });
  it("treats a note with no date prefix as undated", () => {
    expect(parseNotes("Just a note")).toEqual([{ date: null, body: "Just a note" }]);
  });
  it("splits multiple dated notes on ' ---- ', keeping only the first pipe as the date separator", () => {
    expect(parseNotes("1/1/2023|first note ---- 1/2/2023|second|note with a pipe in it")).toEqual([
      { date: "2023-01-01", body: "first note" },
      { date: "2023-01-02", body: "second|note with a pipe in it" },
    ]);
  });
});

describe("buildTransactions", () => {
  it("builds full records from a Dotloop-flavored export", () => {
    const csv = [
      "Property Address,City,State,Zip,Loop Status,Representing,Sales Price,Contract Agreement Date,Closing Date,Agent Name",
      '"412 Maple Avenue",Springfield,il,62704,Under Contract,Buyer,"$385,000",7/15/2026,8/14/2026,Sunrise Realty',
    ].join("\n");
    const { records, issues } = buildTransactions(parseCsv(csv));
    expect(issues).toEqual([]);
    expect(records[0]).toEqual({
      propertyAddress: "412 Maple Avenue",
      city: "Springfield",
      state: "IL",
      zip: "62704",
      status: "UNDER_CONTRACT",
      side: "BUY_SIDE",
      purchasePrice: 385000,
      contractDate: "2026-07-15",
      closeDate: "2026-08-14",
      clientName: "Sunrise Realty",
    });
  });

  it("defaults and flags unrecognized enum values", () => {
    const csv = "Address,Status\n1 Elm St,Weird Stage\n";
    const { records, issues } = buildTransactions(parseCsv(csv));
    expect(records[0].status).toBe("UNDER_CONTRACT");
    expect(issues[0].problem).toContain("unrecognized status");
  });
});
