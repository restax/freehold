import { describe, expect, it } from "vitest";
import { isReservedSlug } from "./reserved-slugs";

describe("isReservedSlug", () => {
  it("reserves the vendor subdomain so no workspace can claim it", () => {
    expect(isReservedSlug("vendor")).toBe(true);
    expect(isReservedSlug("VENDOR")).toBe(true);
  });

  it("reserves the infra subdomains", () => {
    for (const s of ["www", "app", "api", "mail", "demo", "status"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("leaves real workspace slugs alone", () => {
    for (const s of ["smith-realty", "summit-title", "acme"]) {
      expect(isReservedSlug(s)).toBe(false);
    }
  });
});
