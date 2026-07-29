import { TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { ContractUploadForm } from "@/components/contract-upload-form";
import { createFromContract } from "@/lib/actions/extractions";
import { createTransaction } from "@/lib/actions/transactions";
import { STATUS_LABEL } from "@/lib/format";
import { creditBalance, getTenantPlan, isCloud, transactionLimit } from "@/lib/plans";
import { sideLabel, tenantSideLabels } from "@/lib/side-labels";
import { requireTenant } from "@/lib/tenant";
import { btn, card, fieldGroupLabel, input, label, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";
// Contract extraction runs synchronously in the createFromContract server
// action and can take ~90s on a long PDF.
export const maxDuration = 300;

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);

/**
 * Creating a file, on its own page.
 *
 * This used to be two collapsed panels wedged into the transactions list
 * toolbar, which meant "+ Create → Transaction" dropped you on the pipeline
 * with nothing open and no visible way in. Creation is a task with its own
 * beginning and end, so it gets a page; the list goes back to doing one job.
 *
 * Both routes in are offered side by side rather than one behind a
 * disclosure — a coordinator holding a signed PDF and a coordinator opening a
 * file before the contract lands are equally normal.
 */
export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ licenseError?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { licenseError } = await searchParams;
  const [limit, plan, credits, labels] = await Promise.all([
    transactionLimit(tenantId),
    getTenantPlan(tenantId),
    creditBalance(tenantId),
    tenantSideLabels(tenantId),
  ]);
  const { clients, members } = await withTenant(tenantId, async (tx) => ({
    clients: await tx.client.findMany({ orderBy: { name: "asc" } }),
    members: await tx.member.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
  }));

  const needsCredit = isCloud() && plan.tier === "FREE";
  const outOfCredits = needsCredit && credits < 1;
  const aiAvailable = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">New transaction</h1>
        <Link
          href="/dashboard/transactions"
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← Back to transactions
        </Link>
      </div>

      {licenseError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Not created — {licenseError}
        </p>
      )}

      {limit.limited && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You've reached the {limit.limit}-transaction limit on the Free plan ({limit.active}{" "}
          active). Existing files stay fully accessible.{" "}
          <Link href="/dashboard/billing" className="font-medium underline">
            Upgrade
          </Link>{" "}
          to add another.
        </p>
      )}

      {aiAvailable &&
        !limit.limited &&
        (outOfCredits ? (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
            You're out of AI credits.{" "}
            <Link href="/dashboard/billing" className="font-medium text-brand-700 underline">
              Buy more
            </Link>{" "}
            to start from a contract, or enter the transaction manually below.
          </p>
        ) : (
          <section className={`${card} border-brand-600/25 bg-brand-50/40`}>
            <h2 className="font-medium text-stone-900">Start from a contract</h2>
            <p className="mt-1 text-sm text-stone-600">
              Drop in the signed PDF — the AI reads the parties, price, and every deadline, each one
              page-cited and confidence-scored. You confirm before anything is saved. No typing.
            </p>
            <ContractUploadForm action={createFromContract} />
            <p className="mt-2 text-xs text-stone-400">
              PDF, up to 10&nbsp;MB. Extraction takes ~30–90 seconds.
              {needsCredit && ` Uses 1 of your ${credits} AI credit${credits === 1 ? "" : "s"}.`}
            </p>
          </section>
        ))}

      <section className={card}>
        <h2 className="font-medium text-stone-900">
          {aiAvailable ? "Or enter the details yourself" : "Transaction information"}
        </h2>
        <form action={createTransaction} className="mt-4 flex flex-col gap-4">
          <div>
            <p className={fieldGroupLabel}>Property</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
              {/* Picking a suggestion fills City / State / ZIP below, so the
                  four fields describe one real place instead of whatever got
                  typed into each. All four stay editable. */}
              <AddressAutocomplete
                name="propertyAddress"
                label="Address *"
                required
                fills={{ city: "city", state: "state", zip: "zip" }}
              />
              <label className={label}>
                City
                <input name="city" className={input} />
              </label>
              <label className={label}>
                State
                <input name="state" className={input} maxLength={2} />
              </label>
              <label className={label}>
                ZIP
                <input name="zip" className={input} />
              </label>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-3">
            <p className={fieldGroupLabel}>Deal</p>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <label className={label}>
                Status
                <select name="status" className={input} defaultValue="UNDER_CONTRACT">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Side
                <select name="side" className={input} defaultValue="BUY_SIDE">
                  {SIDES.map((s) => (
                    <option key={s} value={s}>
                      {sideLabel(s, labels)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Purchase price ($)
                <input name="purchasePrice" inputMode="numeric" className={input} />
              </label>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-3">
            <p className={fieldGroupLabel}>Key dates</p>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <label className={label}>
                Contract date
                <input name="contractDate" type="date" className={input} />
              </label>
              <label className={label}>
                Close date
                <input name="closeDate" type="date" className={input} />
              </label>
            </div>
          </div>

          <div className="border-t border-stone-100 pt-3">
            <p className={fieldGroupLabel}>Client &amp; team</p>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <label className={label}>
                Client
                <select name="clientId" className={input} defaultValue="">
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Co-agent (managed agent)
                <select name="coAgentClientId" className={input} defaultValue="">
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Assign to
                <select name="assigneeId" className={input} defaultValue="">
                  <option value="">—</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <details className="border-t border-stone-100 pt-3">
            <summary className={`${summaryLink} text-xs`}>Listing details (optional)</summary>
            <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              <label className={label}>
                List price ($)
                <input name="listPrice" inputMode="numeric" className={input} />
              </label>
              <label className={label}>
                List date
                <input name="listDate" type="date" className={input} />
              </label>
              <label className={label}>
                On-market date
                <input name="onMarketDate" type="date" className={input} />
              </label>
              <label className={label}>
                Expire date
                <input name="expireDate" type="date" className={input} />
              </label>
              <label className={label}>
                MLS ID
                <input name="mlsId" className={input} />
              </label>
            </div>
          </details>

          <div className="border-t border-stone-100 pt-3">
            <button type="submit" className={btn}>
              Create transaction
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
