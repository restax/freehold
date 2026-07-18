import { describe, expect, it } from "vitest";
import { tenantSlug } from "./slug.js";

describe("tenantSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(tenantSlug("Smith Realty & Co.")).toBe("smith-realty-co");
  });

  it("strips accents", () => {
    expect(tenantSlug("Peña Título Services")).toBe("pena-titulo-services");
  });

  it("trims leading/trailing separators", () => {
    expect(tenantSlug("  --Acme TC--  ")).toBe("acme-tc");
  });

  it("caps length at 48", () => {
    expect(tenantSlug("x".repeat(100))).toHaveLength(48);
  });
});
