import { describe, expect, it } from "vitest";
import { gqlErrorText, mirrorStatus, mutationError, parseWaveConfig, sameName } from "./wave";

describe("mirrorStatus", () => {
  it("maps the settled outcomes to paid", () => {
    expect(mirrorStatus("PAID")).toBe("PAID");
    expect(mirrorStatus("paid")).toBe("PAID");
    expect(mirrorStatus("OVERPAID")).toBe("PAID");
  });

  it("leaves every in-flight status outstanding", () => {
    for (const s of ["DRAFT", "SAVED", "UNSENT", "SENT", "VIEWED", "PARTIAL", "OVERDUE"]) {
      expect(mirrorStatus(s)).toBe("SENT");
    }
  });

  it("defaults an unknown status to outstanding — never to paid", () => {
    // Telling a tenant they've been paid when they haven't is the one
    // failure mode worth guarding against by construction.
    expect(mirrorStatus("SOME_FUTURE_STATUS")).toBe("SENT");
    expect(mirrorStatus("")).toBe("SENT");
  });
});

describe("parseWaveConfig", () => {
  const good = { businessId: "B1", productId: "P1", tokenEnc: {} };

  it("accepts a fully-formed config", () => {
    expect(parseWaveConfig(good)).not.toBeNull();
  });

  it("rejects anything missing the business, the product, or the token", () => {
    expect(parseWaveConfig(null)).toBeNull();
    expect(parseWaveConfig({})).toBeNull();
    expect(parseWaveConfig({ ...good, businessId: "" })).toBeNull();
    expect(parseWaveConfig({ ...good, productId: "" })).toBeNull();
    expect(parseWaveConfig({ businessId: "B1", productId: "P1" })).toBeNull();
  });
});

describe("mutationError", () => {
  it("says nothing when Wave accepted the mutation", () => {
    expect(mutationError({ didSucceed: true, inputErrors: null })).toBeNull();
  });

  it("reads the refusal out of inputErrors, path included", () => {
    expect(
      mutationError({
        didSucceed: false,
        inputErrors: [{ path: ["items", "0", "productId"], message: "Not found" }],
      }),
    ).toBe("items.0.productId: Not found");
  });

  it("still explains a refusal that came with no errors listed", () => {
    // didSucceed:false with an empty inputErrors is Wave's least helpful
    // answer, and the one most likely to be read as a success.
    expect(mutationError({ didSucceed: false, inputErrors: [] })).toMatch(/declined/);
    expect(mutationError({})).toMatch(/declined/);
  });

  it("keeps the message short enough for a form banner", () => {
    const long = mutationError({
      didSucceed: false,
      inputErrors: Array.from({ length: 9 }, (_, i) => ({ message: "x".repeat(200) + i })),
    });
    expect(long?.length).toBeLessThanOrEqual(300);
  });
});

describe("gqlErrorText", () => {
  it("joins the first few complaints", () => {
    expect(gqlErrorText([{ message: "one" }, { message: "two" }])).toBe("one; two");
  });

  it("never comes back empty, so an error is never rendered as blank", () => {
    expect(gqlErrorText([])).toBe("no reason given");
    expect(gqlErrorText([{}])).toBe("no reason given");
  });
});

describe("sameName", () => {
  it("ignores case and runs of whitespace", () => {
    expect(sameName("TC Services", "  tc   services ")).toBe(true);
  });

  it("still distinguishes different names", () => {
    expect(sameName("TC Services", "TC Service")).toBe(false);
  });
});
