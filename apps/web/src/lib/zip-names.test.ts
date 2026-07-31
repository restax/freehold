import { describe, expect, it } from "vitest";
import { uniqueEntryName, zipFilename } from "./zip-names";

describe("uniqueEntryName", () => {
  it("keeps an ordinary filename as-is", () => {
    expect(uniqueEntryName("disclosure.pdf", new Set())).toBe("disclosure.pdf");
  });

  it("replaces characters that break archives", () => {
    expect(uniqueEntryName("Purchase/Sale: final.pdf", new Set())).toBe("Purchase_Sale_ final.pdf");
  });

  it("numbers a repeated name before the extension, not after", () => {
    const used = new Set<string>();
    expect(uniqueEntryName("scan.pdf", used)).toBe("scan.pdf");
    expect(uniqueEntryName("scan.pdf", used)).toBe("scan (2).pdf");
    expect(uniqueEntryName("scan.pdf", used)).toBe("scan (3).pdf");
  });

  it("handles a repeated name with no extension", () => {
    const used = new Set<string>();
    expect(uniqueEntryName("notes", used)).toBe("notes");
    expect(uniqueEntryName("notes", used)).toBe("notes (2)");
  });

  it("does not collide with a file whose own name looks numbered", () => {
    const used = new Set<string>();
    // Parentheses aren't filename-safe, so an uploaded "scan (2).pdf" is
    // sanitised out of the way of the names this generates.
    expect(uniqueEntryName("scan (2).pdf", used)).toBe("scan _2_.pdf");
    expect(uniqueEntryName("scan.pdf", used)).toBe("scan.pdf");
    expect(uniqueEntryName("scan.pdf", used)).toBe("scan (2).pdf");
  });
});

describe("zipFilename", () => {
  it("names the archive after the property", () => {
    expect(zipFilename("88 Harbor Lane")).toBe("88 Harbor Lane.zip");
  });

  it("strips punctuation a filesystem would object to", () => {
    expect(zipFilename("88 Harbor Ln, Springfield, IL")).toBe("88 Harbor Ln Springfield IL.zip");
  });

  it("falls back when the address has nothing usable in it", () => {
    expect(zipFilename("///")).toBe("documents.zip");
  });
});
