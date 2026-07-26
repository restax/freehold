import { describe, expect, it } from "vitest";
import {
  clientBillingPolicy,
  DEFAULT_BILLING_POLICY,
  resolveDefaultFee,
  tenantBillingPolicy,
} from "./billing-policy";

describe("tenantBillingPolicy", () => {
  it("falls back to defaults when unset or malformed", () => {
    expect(tenantBillingPolicy(null)).toEqual(DEFAULT_BILLING_POLICY);
    expect(tenantBillingPolicy({ mode: "sometimes" })).toEqual(DEFAULT_BILLING_POLICY);
    expect(tenantBillingPolicy("garbage")).toEqual(DEFAULT_BILLING_POLICY);
  });

  it("applies partial config over defaults", () => {
    const p = tenantBillingPolicy({ mode: "monthly", defaultFeeCents: 40000 });
    expect(p.mode).toBe("monthly");
    expect(p.defaultFeeCents).toBe(40000);
    expect(p.depositPercent).toBe(DEFAULT_BILLING_POLICY.depositPercent);
  });

  it("clamps out-of-range numbers instead of trusting them", () => {
    const p = tenantBillingPolicy({
      depositPercent: 900,
      lateFee: { enabled: true, percent: 250, graceDays: -3 },
    });
    expect(p.depositPercent).toBe(100);
    expect(p.lateFee.percent).toBe(100);
    expect(p.lateFee.graceDays).toBe(0);
    expect(p.lateFee.enabled).toBe(true);
  });
});

describe("clientBillingPolicy", () => {
  const tenant = {
    mode: "per_file_close",
    lateFee: { enabled: true, type: "flat", flatCents: 2500 },
  };

  it("client keys override tenant keys; unset keys inherit", () => {
    const p = clientBillingPolicy(tenant, { mode: "monthly" });
    expect(p.mode).toBe("monthly");
    expect(p.lateFee.enabled).toBe(true);
    expect(p.lateFee.flatCents).toBe(2500);
  });

  it("a client can switch late fees off while the workspace charges them", () => {
    const p = clientBillingPolicy(tenant, { lateFee: { enabled: false } });
    expect(p.lateFee.enabled).toBe(false);
    // ...and the reverse: workspace off, one client on.
    const q = clientBillingPolicy(null, { lateFee: { enabled: true } });
    expect(q.lateFee.enabled).toBe(true);
  });

  it("no client config means exactly the tenant policy", () => {
    expect(clientBillingPolicy(tenant, null)).toEqual(tenantBillingPolicy(tenant));
  });
});

describe("resolveDefaultFee", () => {
  it("client fee beats workspace fee beats nothing", () => {
    const policy = tenantBillingPolicy({ defaultFeeCents: 30000 });
    expect(resolveDefaultFee(35000, policy)).toBe(35000);
    expect(resolveDefaultFee(null, policy)).toBe(30000);
    expect(resolveDefaultFee(null, tenantBillingPolicy(null))).toBeNull();
  });
});
