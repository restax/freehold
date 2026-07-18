import { describe, expect, it } from "vitest";
import {
  buildContacts,
  buildTransactions,
  mapTransactionHeaders,
  parseCsv,
  parseDate,
  parseMoney,
  parseSide,
  parseStatus,
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

describe("buildContacts", () => {
  it("builds records and reports skipped rows", () => {
    const rows = parseCsv(
      "Full Name,Email Address,Cell\nJane Smith,jane@x.com,312-555-0110\n,missing@x.com,\n",
    );
    const { records, issues } = buildContacts(rows);
    expect(records).toEqual([
      { name: "Jane Smith", email: "jane@x.com", phone: "312-555-0110", category: null },
    ]);
    expect(issues).toEqual([{ row: 3, problem: "missing name; row skipped" }]);
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
