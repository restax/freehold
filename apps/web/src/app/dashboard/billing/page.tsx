import { billingEnabled, creditsEnabled } from "@freehold/ee-billing";
import {
  openBillingPortal,
  redeemCode,
  redeemCreditCode,
  startCreditCheckout,
  startUpgrade,
} from "@/lib/actions/billing";
import { PAYMENTS_PAUSED } from "@/lib/payments-paused";
import {
  CREDIT_PACKS,
  countActiveTransactions,
  creditBalance,
  getTenantPlan,
  isCloud,
  PLAN_INFO,
  seatState,
} from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    upgraded?: string;
    redeemed?: string;
    codeError?: string;
    purchased?: string;
    creditRedeemed?: string;
    creditError?: string;
  }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { upgraded, redeemed, codeError, purchased, creditRedeemed, creditError } =
    await searchParams;
  const [plan, seats, activeTxns, credits] = await Promise.all([
    getTenantPlan(tenantId),
    seatState(tenantId),
    countActiveTransactions(tenantId),
    creditBalance(tenantId),
  ]);
  const freeMetered = isCloud() && plan.tier === "FREE";
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

      {redeemed && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Code applied — your workspace is now on the complimentary{" "}
          {PLAN_INFO[redeemed as keyof typeof PLAN_INFO]?.label ?? redeemed} plan.
        </p>
      )}

      {purchased && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Payment received — {purchased} credit{purchased === "1" ? "" : "s"} will appear within a
          few seconds of Stripe's confirmation.
        </p>
      )}

      {codeError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{codeError}</p>
      )}

      {creditRedeemed && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Coupon applied — {creditRedeemed} credit{creditRedeemed === "1" ? "" : "s"} added to your
          workspace.
        </p>
      )}

      {creditError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{creditError}</p>
      )}

      {plan.comped && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          You're on a <strong>complimentary {info.label}</strong> plan — full access, no charge. No
          credit card is needed while this is active.
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
              — ${info.priceMonthly}/mo, {plan.seatLimit} users included
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
          <li>
            AI:{" "}
            {freeMetered
              ? `${credits} credit${credits === 1 ? "" : "s"} available — each unlocks pro AI (extraction, classify, dictation) on one transaction`
              : "included, unmetered"}
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

      {isAdmin && freeMetered && billingEnabled() && creditsEnabled() && !PAYMENTS_PAUSED && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Buy AI credits</h2>
          <p className="mb-3 text-sm text-stone-500">
            Each credit permanently unlocks pro AI — contract extraction, document classify, and
            dictation — on one transaction. You have{" "}
            <strong>
              {credits} credit{credits === 1 ? "" : "s"}
            </strong>{" "}
            now.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <form
                key={pack.credits}
                action={startCreditCheckout}
                className={`${card} flex flex-col items-start gap-1`}
              >
                <input type="hidden" name="credits" value={pack.credits} />
                <p className="font-serif text-2xl font-semibold tabular-nums">${pack.amountUsd}</p>
                <p className="text-sm text-stone-600">
                  {pack.credits} credit{pack.credits === 1 ? "" : "s"}
                  <span className="text-stone-400">
                    {" "}
                    · ${(pack.amountUsd / pack.credits).toFixed(0)}/credit
                  </span>
                </p>
                <button type="submit" className={`${btn} mt-2 w-full justify-center`}>
                  Buy
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">One-time purchase. Credits never expire.</p>
        </section>
      )}

      {isAdmin && freeMetered && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Have a credit code?</h2>
          <p className="mb-3 text-sm text-stone-500">
            Redeem a coupon for free AI credits — no charge.
          </p>
          <form action={redeemCreditCode} className="flex flex-wrap items-center gap-2">
            <input
              name="code"
              required
              placeholder="CREDIT-XXXX-XXXX"
              className={`${input} w-56 font-mono uppercase`}
            />
            <button type="submit" className={btn}>
              Redeem
            </button>
          </form>
        </section>
      )}

      {!billingEnabled() ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Billing isn't configured on this instance — set <code>STRIPE_SECRET_KEY</code>,{" "}
          <code>STRIPE_WEBHOOK_SECRET</code>, and the <code>STRIPE_PRICE_*</code> ids.
        </p>
      ) : (
        isAdmin &&
        !PAYMENTS_PAUSED &&
        !plan.comped && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(["PRO", "BUSINESS"] as const).map((tier) => (
              <section
                key={tier}
                className={`${card} flex flex-col ${tier === "PRO" ? "border-brand-600/30 ring-1 ring-brand-600/15" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">{PLAN_INFO[tier].label}</h3>
                  {tier === "PRO" && (
                    <span className="text-xs font-medium uppercase tracking-wide text-brand-700">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mb-1 font-serif text-3xl font-semibold tabular-nums">
                  ${PLAN_INFO[tier].priceMonthly}
                  <span className="font-sans text-sm font-normal text-stone-500">/mo</span>
                </p>
                <ul className="mb-3 flex min-h-16 flex-col gap-0.5 text-sm text-stone-600">
                  <li>{PLAN_INFO[tier].includedSeats} users included</li>
                  <li>{PLAN_INFO[tier].activeTransactionLimit} active transactions a month</li>
                  <li>Up to 200 active clients</li>
                  <li>AI contract extraction included</li>
                  {tier === "BUSINESS" ? <li>Priority support</li> : <li>All integrations</li>}
                </ul>
                <form action={startUpgrade} className="mt-auto">
                  <input type="hidden" name="tier" value={tier} />
                  {plan.tier === tier ? (
                    <p className="text-sm text-stone-500">Your current plan.</p>
                  ) : (
                    <button type="submit" className={btn}>
                      Upgrade to {PLAN_INFO[tier].label}
                    </button>
                  )}
                </form>
              </section>
            ))}
          </div>
        )
      )}

      {isAdmin && !plan.comped && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Have a code?</h2>
          <p className="mb-3 text-sm text-stone-500">
            Enter a complimentary-plan code to unlock a full plan — no credit card, no checkout.
          </p>
          <form action={redeemCode} className="flex flex-wrap items-center gap-2">
            <input
              name="code"
              required
              placeholder="COMP-XXXX-XXXX"
              className={`${input} w-56 font-mono uppercase`}
            />
            <button type="submit" className={btn}>
              Redeem
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
