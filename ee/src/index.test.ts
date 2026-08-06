import { describe, expect, it } from "vitest";
import { billingEnabled, creditPurchaseFromEvent, planUpdateFromEvent } from "./index.js";

const subEvent = (type: string, sub: Record<string, unknown>) =>
  ({ type, data: { object: sub } }) as never;

const BASE_SUB = {
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  metadata: { tenantId: "tenant-1", tier: "PRO" },
  items: { data: [{ quantity: 5 }] },
};

describe("planUpdateFromEvent", () => {
  it("maps an active subscription to a paid tier with the tier's included seats", () => {
    const update = planUpdateFromEvent(subEvent("customer.subscription.created", BASE_SUB));
    expect(update).toEqual({
      tenantId: "tenant-1",
      tier: "PRO",
      seats: 2,
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "active",
      suspended: false,
    });
  });

  it("keeps a trialing subscription healthy (not suspended)", () => {
    const update = planUpdateFromEvent(
      subEvent("customer.subscription.updated", { ...BASE_SUB, status: "trialing" }),
    );
    expect(update?.tier).toBe("PRO");
    expect(update?.suspended).toBe(false);
  });

  it("locks immediately on a failed renewal (past_due) while keeping the paid tier", () => {
    const update = planUpdateFromEvent(
      subEvent("customer.subscription.updated", { ...BASE_SUB, status: "past_due" }),
    );
    expect(update?.suspended).toBe(true);
    expect(update?.tier).toBe("PRO");
    expect(update?.subscriptionId).toBe("sub_123");
  });

  it("locks on unpaid too", () => {
    const update = planUpdateFromEvent(
      subEvent("customer.subscription.updated", { ...BASE_SUB, status: "unpaid" }),
    );
    expect(update?.suspended).toBe(true);
  });

  it("maps a voluntary cancellation back to FREE, not suspended", () => {
    const update = planUpdateFromEvent(subEvent("customer.subscription.deleted", BASE_SUB));
    expect(update?.tier).toBe("FREE");
    expect(update?.seats).toBe(1);
    expect(update?.subscriptionId).toBeNull();
    expect(update?.suspended).toBe(false);
  });

  it("locks a nonpayment cancellation instead of dropping to FREE", () => {
    const update = planUpdateFromEvent(
      subEvent("customer.subscription.deleted", {
        ...BASE_SUB,
        cancellation_details: { reason: "payment_failed" },
      }),
    );
    expect(update?.suspended).toBe(true);
    expect(update?.tier).toBe("PRO");
  });

  it("respects BUSINESS tier metadata and grants its 10 included seats", () => {
    const update = planUpdateFromEvent(
      subEvent("customer.subscription.updated", {
        ...BASE_SUB,
        metadata: { tenantId: "tenant-1", tier: "BUSINESS" },
      }),
    );
    expect(update?.tier).toBe("BUSINESS");
    expect(update?.seats).toBe(10);
  });

  it("ignores events without tenant metadata or of other types", () => {
    expect(
      planUpdateFromEvent(subEvent("customer.subscription.updated", { ...BASE_SUB, metadata: {} })),
    ).toBeNull();
    expect(planUpdateFromEvent(subEvent("invoice.paid", BASE_SUB))).toBeNull();
  });
});

const checkoutEvent = (type: string, cs: Record<string, unknown>) =>
  ({ type, data: { object: cs } }) as never;

const PAID_CREDIT_SESSION = {
  id: "cs_test_1",
  mode: "payment",
  payment_status: "paid",
  metadata: { tenantId: "tenant-1", credits: "5" },
};

describe("creditPurchaseFromEvent", () => {
  it("maps a paid one-time session to a credit grant with the session id as key", () => {
    expect(
      creditPurchaseFromEvent(checkoutEvent("checkout.session.completed", PAID_CREDIT_SESSION)),
    ).toEqual({
      tenantId: "tenant-1",
      credits: 5,
      sessionId: "cs_test_1",
      opinlyAnonId: null,
    });
  });

  it("carries opinlyAnonId through from metadata when present", () => {
    expect(
      creditPurchaseFromEvent(
        checkoutEvent("checkout.session.completed", {
          ...PAID_CREDIT_SESSION,
          metadata: { ...PAID_CREDIT_SESSION.metadata, opinlyAnonId: "anon-123" },
        }),
      ),
    ).toEqual({
      tenantId: "tenant-1",
      credits: 5,
      sessionId: "cs_test_1",
      opinlyAnonId: "anon-123",
    });
  });

  it("ignores a subscription checkout (mode !== payment) — plan path handles those", () => {
    expect(
      creditPurchaseFromEvent(
        checkoutEvent("checkout.session.completed", {
          ...PAID_CREDIT_SESSION,
          mode: "subscription",
        }),
      ),
    ).toBeNull();
  });

  it("ignores an unpaid session", () => {
    expect(
      creditPurchaseFromEvent(
        checkoutEvent("checkout.session.completed", {
          ...PAID_CREDIT_SESSION,
          payment_status: "unpaid",
        }),
      ),
    ).toBeNull();
  });

  it("ignores a session with no credits/tenant metadata, and non-completion events", () => {
    expect(
      creditPurchaseFromEvent(
        checkoutEvent("checkout.session.completed", { ...PAID_CREDIT_SESSION, metadata: {} }),
      ),
    ).toBeNull();
    expect(
      creditPurchaseFromEvent(checkoutEvent("checkout.session.expired", PAID_CREDIT_SESSION)),
    ).toBeNull();
  });
});

describe("billingEnabled", () => {
  it("reflects STRIPE_SECRET_KEY presence", () => {
    expect(typeof billingEnabled()).toBe("boolean");
  });
});
