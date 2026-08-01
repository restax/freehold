import { prisma, withTenant } from "@freehold/db";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badges";
import { PhoneInput } from "@/components/phone-input";
import { SectionCard } from "@/components/section-card";
import { addLicense, deleteLicense } from "@/lib/actions/licenses";
import { disconnectNylas } from "@/lib/actions/nylas";
import { requestPayment, withdrawPaymentRequest } from "@/lib/actions/pay";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { type AttributableInvoice, transactionBilling } from "@/lib/billing";
import { formatPercentBp, payoutCents } from "@/lib/billing-payouts";
import { fmtDate, STATUS_LABEL } from "@/lib/format";
import { HEALTH_LABEL, licenseHealth } from "@/lib/licenses";
import { fmtCents } from "@/lib/pay";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, input, label, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** What came back from the mailbox connect round trip, in plain language. */
const NYLAS_FLASH: Record<string, string> = {
  connected: "Your mailbox is connected. You can now send as yourself.",
  denied: "You cancelled before granting access, so nothing was connected.",
  invalid: "That connection link had expired. Please try connecting again.",
  failed: "We couldn't finish connecting your mailbox. Please try again.",
  unconfigured: "Sending from your own mailbox isn't set up on this install yet.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ nylas?: string }>;
}) {
  // Guests keep their own profile, licenses, and pay — all of it their data.
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const nylasFlash = (await searchParams).nylas;
  const [user, licenses, unbilled, payRequests, nylasGrant] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, phone: true },
    }),
    withTenant(tenantId, (tx) =>
      tx.userLicense.findMany({
        where: { userId },
        orderBy: [{ state: "asc" }, { createdAt: "asc" }],
      }),
    ),
    // Assignments carrying a payout basis (flat or % of the file's fee
    // revenue) that haven't been submitted for payment yet.
    withTenant(tenantId, async (tx) => {
      const rows = await tx.transactionAssignee.findMany({
        where: {
          userId,
          OR: [{ feeCents: { not: null } }, { feePercentBp: { not: null } }],
          paymentItem: { is: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          feeCents: true,
          feePercentBp: true,
          transactionId: true,
          transaction: { select: { id: true, propertyAddress: true, status: true } },
        },
      });
      // Percent payouts read against what's collected on the file today.
      const pctFiles = [
        ...new Set(rows.filter((r) => r.feePercentBp != null).map((r) => r.transactionId)),
      ];
      const invoices: AttributableInvoice[] =
        pctFiles.length > 0
          ? await tx.invoice.findMany({
              where: {
                OR: [
                  { transactionId: { in: pctFiles } },
                  { lines: { some: { transactionId: { in: pctFiles } } } },
                ],
              },
              select: {
                status: true,
                provider: true,
                transactionId: true,
                amountCents: true,
                lines: { select: { transactionId: true, amountCents: true } },
                payments: { select: { amountCents: true } },
              },
            })
          : [];
      return rows.map((r) => ({
        ...r,
        payableCents:
          r.feeCents ??
          payoutCents(
            { feeCents: null, feePercentBp: r.feePercentBp },
            transactionBilling(r.transactionId, invoices).paidCents,
          ),
      }));
    }),
    withTenant(tenantId, (tx) =>
      tx.paymentRequest.findMany({
        where: { userId },
        orderBy: { requestedAt: "desc" },
        include: { items: { select: { address: true, feeCents: true } } },
      }),
    ),
    prisma.nylasGrant.findUnique({
      where: { userId },
      select: { email: true, provider: true, status: true, lastError: true, connectedAt: true },
    }),
  ]);
  const unbilledTotal = unbilled.reduce((sum, a) => sum + a.payableCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="text-sm text-stone-500">
          How you appear to your workspace — photo, name, and the state licenses you hold.
        </p>
      </div>

      <SectionCard title="Photo & name">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar user={user} size={96} />
            <form action={uploadAvatar} className="flex flex-col items-center gap-1.5">
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                required
                className="max-w-52 text-xs"
              />
              <button type="submit" className={`${btnGhost} px-2 py-1 text-xs`}>
                Upload photo
              </button>
            </form>
            {user.image && (
              <form action={removeAvatar}>
                <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                  remove photo
                </button>
              </form>
            )}
          </div>
          <form action={updateProfile} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              Display name
              <input name="name" defaultValue={user.name} required className={input} />
            </label>
            <label className={label}>
              Phone
              <PhoneInput
                name="phone"
                defaultValue={user.phone ?? ""}
                placeholder="(312) 555-0148"
                className={input}
              />
            </label>
            <button type="submit" className={btn}>
              Save
            </button>
            <p className="w-full text-xs text-stone-400">
              Signed in as {user.email}. Your name and phone appear on the signature card of emails
              you send, and in templates as <code className="font-mono">{"{{tc_phone}}"}</code>.
            </p>
          </form>
        </div>
      </SectionCard>

      <SectionCard
        title="Your email"
        icon={<EnvelopeSimple size={15} weight="fill" aria-hidden />}
        action={
          nylasGrant ? (
            <form action={disconnectNylas}>
              <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                Disconnect
              </button>
            </form>
          ) : null
        }
      >
        <p className="mb-3 text-sm text-stone-500">
          By default your workspace sends from its own Freehold address, and replies come back onto
          the transaction automatically. Connect your own mailbox to send as yourself instead —
          recipients see your real address, and the sent copy lands in your own Sent folder.
        </p>

        {nylasFlash && (
          <p
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              nylasFlash === "connected"
                ? "bg-brand-50 text-brand-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {NYLAS_FLASH[nylasFlash] ?? "Something went wrong connecting your mailbox."}
          </p>
        )}

        {nylasGrant ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{nylasGrant.email}</span>
            <Badge tone={nylasGrant.status === "valid" ? "success" : "danger"}>
              {nylasGrant.status === "valid" ? "Connected" : "Needs reconnecting"}
            </Badge>
            {nylasGrant.provider && (
              <span className="text-xs uppercase tracking-wide text-stone-400">
                {nylasGrant.provider}
              </span>
            )}
            <span className="ml-auto text-xs text-stone-400">
              since {fmtDate(nylasGrant.connectedAt)}
            </span>
            {nylasGrant.status !== "valid" && (
              <p className="w-full text-xs text-amber-700">
                {nylasGrant.lastError ??
                  "Your mail provider ended this connection. Reconnect to keep sending as yourself."}
              </p>
            )}
          </div>
        ) : (
          <a href="/api/nylas/connect" className={btn}>
            Connect your mailbox
          </a>
        )}
      </SectionCard>

      {(unbilled.length > 0 || payRequests.length > 0) && (
        <SectionCard title="Your pay">
          <p className="mb-3 text-sm text-stone-500">
            What you're owed for the files you're assigned to. Submit them whenever your workspace's
            policy says they're due — on assignment, at closing, or anywhere in between.
          </p>

          {unbilled.length > 0 ? (
            <form action={requestPayment} className="mb-4">
              <ul className="mb-3 flex flex-col">
                {unbilled.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <input
                      type="checkbox"
                      name="assigneeIds"
                      value={a.id}
                      defaultChecked
                      className="accent-brand-600"
                    />
                    <Link
                      href={`/dashboard/transactions/${a.transaction.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {a.transaction.propertyAddress}
                    </Link>
                    <span className="text-xs text-stone-400">
                      {STATUS_LABEL[a.transaction.status]}
                    </span>
                    {a.feePercentBp != null && (
                      <span className="text-xs text-stone-400">
                        {formatPercentBp(a.feePercentBp)} of collected
                        {a.payableCents === 0 && " — nothing collected yet"}
                      </span>
                    )}
                    <span className="ml-auto tabular-nums">{fmtCents(a.payableCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-sm text-stone-600">
                  Unbilled total <strong className="tabular-nums">{fmtCents(unbilledTotal)}</strong>
                </span>
                <label className={`${label} min-w-56 flex-1`}>
                  Note (optional)
                  <input name="note" className={input} placeholder="July coordination work" />
                </label>
                <button type="submit" className={btn}>
                  Request payment
                </button>
              </div>
            </form>
          ) : (
            <p className="mb-4 text-sm text-stone-400">Nothing unbilled right now.</p>
          )}

          {payRequests.length > 0 && (
            <div className="border-t border-stone-100 pt-3">
              <h3 className="mb-2 text-sm font-medium text-stone-700">Your requests</h3>
              <ul className="flex flex-col">
                {payRequests.map((r) => {
                  const total = r.items.reduce((s, i) => s + i.feeCents, 0);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                    >
                      <Badge tone={r.status === "PAID" ? "success" : "progress"}>
                        {r.status === "PAID" ? "Paid" : "Awaiting payment"}
                      </Badge>
                      <span className="tabular-nums font-medium">{fmtCents(total)}</span>
                      <span className="text-xs text-stone-400">
                        {r.items.length} file{r.items.length === 1 ? "" : "s"} · requested{" "}
                        {fmtDate(r.requestedAt)}
                        {r.paidAt ? ` · paid ${fmtDate(r.paidAt)}` : ""}
                        {r.paidNote ? ` (${r.paidNote})` : ""}
                      </span>
                      <a
                        href={`/api/pay-requests/${r.id}/statement`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 hover:underline"
                      >
                        statement
                      </a>
                      {r.status !== "PAID" && (
                        <form action={withdrawPaymentRequest} className="ml-auto">
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-300 hover:text-red-600"
                          >
                            withdraw
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Your licenses">
        <p className="mb-3 text-sm text-stone-500">
          States where you hold a license, with an optional uploaded copy. Some states require a
          licensed coordinator on every file — your workspace's rules live in Settings.
        </p>
        {licenses.length === 0 ? (
          <p className="mb-4 text-sm text-stone-400">No licenses on record.</p>
        ) : (
          <table className="mb-4 w-full">
            <thead>
              <tr>
                <th className={th}>State</th>
                <th className={th}>License</th>
                <th className={th}>Expires</th>
                <th className={th}>Status</th>
                <th className={th}>Copy</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic) => {
                const health = licenseHealth(lic.expiresAt);
                return (
                  <tr key={lic.id} className={trHover}>
                    <td className={`${td} font-medium`}>{lic.state}</td>
                    <td className={td}>
                      {lic.label ?? "License"}
                      {lic.licenseNumber && (
                        <span className="ml-2 text-xs text-stone-400">#{lic.licenseNumber}</span>
                      )}
                    </td>
                    <td className={td}>
                      {lic.expiresAt ? (
                        fmtDate(lic.expiresAt)
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className={td}>
                      <Badge
                        tone={
                          health === "expired"
                            ? "danger"
                            : health === "expiring"
                              ? "progress"
                              : "success"
                        }
                      >
                        {HEALTH_LABEL[health]}
                      </Badge>
                    </td>
                    <td className={td}>
                      {lic.filename ? (
                        <a
                          href={`/api/licenses/${lic.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-600 hover:underline"
                        >
                          open
                        </a>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className={td}>
                      <form action={deleteLicense}>
                        <input type="hidden" name="id" value={lic.id} />
                        <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                          remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <form action={addLicense} className="flex flex-wrap items-end gap-3">
          <label className={label}>
            State *
            <input
              name="state"
              required
              maxLength={2}
              className={`${input} w-20`}
              placeholder="TX"
            />
          </label>
          <label className={label}>
            Type
            <input name="label" className={input} placeholder="Salesperson" />
          </label>
          <label className={label}>
            License #
            <input name="licenseNumber" className={input} />
          </label>
          <label className={label}>
            Expires
            <input name="expiresAt" type="date" className={input} />
          </label>
          <label className={`${label} min-w-56`}>
            Copy (PDF or image, max 10 MB)
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf,image/*"
              className={input}
            />
          </label>
          <button type="submit" className={btn}>
            Add license
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
