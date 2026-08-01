import { describe, expect, it } from "vitest";
import { digitsOf, formatUsDigits, formatUsPhone, isFormattableUsPhone } from "./phone";

describe("formatUsPhone", () => {
  it("formats a bare ten-digit number", () => {
    expect(formatUsPhone("3125550101")).toBe("(312) 555-0101");
  });

  it("reformats a half-dressed number into the one shape", () => {
    expect(formatUsPhone("312-555-0101")).toBe("(312) 555-0101");
    expect(formatUsPhone("312.555.0101")).toBe("(312) 555-0101");
    expect(formatUsPhone("555-0101")).toBe("(555) 010-1");
  });

  it("keeps a leading 1 for eleven digits", () => {
    expect(formatUsPhone("13125550101")).toBe("1 (312) 555-0101");
  });

  it("formats progressively while typing", () => {
    expect(formatUsDigits("")).toBe("");
    expect(formatUsDigits("3")).toBe("(3");
    expect(formatUsDigits("312")).toBe("(312");
    expect(formatUsDigits("3125")).toBe("(312) 5");
    expect(formatUsDigits("312555")).toBe("(312) 555");
    expect(formatUsDigits("3125550")).toBe("(312) 555-0");
  });

  it("leaves international numbers alone", () => {
    // "+81 3 1234 5678" is a fine phone number; (813) 123-4567 8 is not.
    expect(formatUsPhone("+81 3 1234 5678")).toBe("+81 3 1234 5678");
    expect(isFormattableUsPhone("+13125550101")).toBe(false);
  });

  it("leaves extensions and notes alone", () => {
    expect(formatUsPhone("312-555-0101 x22")).toBe("312-555-0101 x22");
    expect(formatUsPhone("ask for Dana")).toBe("ask for Dana");
  });

  it("leaves over-long digit strings alone rather than truncating", () => {
    expect(formatUsPhone("312555010199")).toBe("312555010199");
    expect(formatUsPhone("23125550101")).toBe("23125550101");
  });

  it("extracts digits regardless of dressing", () => {
    expect(digitsOf("(312) 555-0101")).toBe("3125550101");
  });
});
