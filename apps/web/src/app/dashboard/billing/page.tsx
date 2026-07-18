import { billingEnabled } from "@freehold/ee-billing";
import { openBillingPortal, startUpgrade } from "@/lib/actions/billing";
import { countActiveTransactions, getTenantPlan, isCloud, PLAN_INFO, seatState } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { upgraded } = await searchParams;
  const [plan, seats, activeTxns] = await Promise.all([
    getTenantPlan(tenantId),
    seatState(tenantId),
    countActiveTransactions(tenantId),
  ]);
  const info = PLAN_INFO[plan.tier];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Plan &amp; billing</h1>
        <p className="text-sm text-stone-500">
          Freehold Cloud plans. Self-hosted Freehold is free and unlimited forever — these plans buy
          hosting, included AI, and support.
        </p>
      </div>

      {upgraded && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Payment received — your plan updates within a few seconds of Stripe's confirmation.
        </p>
      )}

      {!isCloud() && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
          This instance isn't running in Cloud mode (<code>FREEHOLD_CLOUD</code>) — no limits are
          enforced here.
        </p>
      )}

      <section className={card}>
        <h2 className="mb-2 font-medium">
          Current plan: {info.label}
          {info.priceMonthly ? (
            <span className="text-sm font-normal text-stone-500">
              {" "}
              — ${info.priceMonthly}/user/mo × {plan.seatLimit} seats
            </span>
          ) : null}
        </h2>
        <ul className="flex flex-col gap-1 text-sm text-stone-600">
          <li>
            Seats: {seats.used} of {plan.seatLimit} in use
          </li>
          <li>
            Active transactions: {activeTxns}
            {plan.activeTransactionLimit != null
              ? ` of ${plan.activeTransactionLimit}`
              : " (unlimited)"}
          </li>
        </ul>
        {plan.stripeCustomerId && isAdmin && billingEnabled() && (
          <form action={openBillingPortal} className="mt-3">
            <button type="submit" className={btnGhost}>
              Manage billing (invoices, card, cancel)
            </button>
          </form>
        )}
      </section>

      {!billingEnabled() ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Billing isn't configured on this instance — set <code>STRIPE_SECRET_KEY</code>,{" "}
          <code>STRIPE_WEBHOOK_SECRET</code>, and the <code>STRIPE_PRICE_*</code> ids.
        </p>
      ) : (
        isAdmin && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["PRO", "BUSINESS"] as const).map((tier) => (
              <section key={tier} className={card}>
                <h3 className="font-medium">{PLAN_INFO[tier].label}</h3>
                <p className="mb-1 text-2xl font-semibold">
                  ${PLAN_INFO[tier].priceMonthly}
                  <span className="text-sm font-normal text-stone-500">/user/mo</span>
                </p>
                <ul className="mb-3 flex flex-col gap-0.5 text-sm text-stone-600">
                  <li>Unlimited transactions</li>
                  <li>AI contract extraction included</li>
                  {tier === "BUSINESS" ? (
                    <>
                      <li>Priority support</li>
                      <li>Client sub-billing (coming)</li>
                    </>
                  ) : (
                    <li>All integrations</li>
                  )}
                </ul>
                <form action={startUpgrade} className="flex items-end gap-2">
                  <input type="hidden" name="tier" value={tier} />
                  <label className={label}>
                    Seats
                    <input
                      name="seats"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={Math.max(seats.used, 2)}
                      className={`${input} w-20`}
                    />
                  </label>
                  <button type="submit" className={btn}>
                    {plan.tier === tier ? "Change seats" : `Upgrade to ${PLAN_INFO[tier].label}`}
                  </button>
                </form>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}
