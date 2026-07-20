import { EngagementStatus } from "@freehold/db";
import { describe, expect, it } from "vitest";
import { canEnd, canRespond, grantsAccess } from "./engagements";

const HIRER = "tenant-hirer";
const VENDOR = "tenant-vendor";
const STRANGER = "tenant-stranger";

const engagement = (status: EngagementStatus) => ({
  tenantId: HIRER,
  vendorTenantId: VENDOR,
  status,
});

describe("canRespond", () => {
  it("lets the vendor answer a pending request", () => {
    expect(canRespond(engagement(EngagementStatus.REQUESTED), VENDOR)).toBe(true);
  });

  it("does not let the hirer accept on the vendor's behalf", () => {
    expect(canRespond(engagement(EngagementStatus.REQUESTED), HIRER)).toBe(false);
  });

  it("does not let an unrelated workspace answer", () => {
    expect(canRespond(engagement(EngagementStatus.REQUESTED), STRANGER)).toBe(false);
  });

  it("cannot answer twice", () => {
    expect(canRespond(engagement(EngagementStatus.ACTIVE), VENDOR)).toBe(false);
    expect(canRespond(engagement(EngagementStatus.DECLINED), VENDOR)).toBe(false);
    expect(canRespond(engagement(EngagementStatus.ENDED), VENDOR)).toBe(false);
  });
});

describe("canEnd", () => {
  it("lets either party end a running engagement", () => {
    expect(canEnd(engagement(EngagementStatus.ACTIVE), HIRER)).toBe(true);
    expect(canEnd(engagement(EngagementStatus.ACTIVE), VENDOR)).toBe(true);
  });

  it("does not let an unrelated workspace end it", () => {
    expect(canEnd(engagement(EngagementStatus.ACTIVE), STRANGER)).toBe(false);
  });

  it("will not end something that never started or already finished", () => {
    for (const s of [
      EngagementStatus.REQUESTED,
      EngagementStatus.DECLINED,
      EngagementStatus.ENDED,
    ]) {
      expect(canEnd(engagement(s), HIRER)).toBe(false);
    }
  });
});

describe("grantsAccess", () => {
  it("grants access only while active", () => {
    expect(grantsAccess(EngagementStatus.ACTIVE)).toBe(true);
    expect(grantsAccess(EngagementStatus.REQUESTED)).toBe(false);
    expect(grantsAccess(EngagementStatus.DECLINED)).toBe(false);
    expect(grantsAccess(EngagementStatus.ENDED)).toBe(false);
  });
});
