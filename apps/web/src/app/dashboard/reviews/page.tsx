import { withTenant } from "@freehold/db";
import { Star } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { businessAverage, coordinatorStandings } from "@/lib/reviews";
import { requireAdminTenant } from "@/lib/tenant";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

function Stars({ value }: { value: number }) {
  return (
    <span
      role="img"
      className="inline-flex items-center gap-0.5"
      aria-label={`${value.toFixed(1)} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          weight={n <= Math.round(value) ? "fill" : "regular"}
          className={n <= Math.round(value) ? "text-amber-500" : "text-stone-300"}
          aria-hidden
        />
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  const { tenantId } = await requireAdminTenant();

  const reviews = await withTenant(tenantId, (tx) =>
    tx.clientReview.findMany({
      orderBy: [{ answeredAt: "desc" }, { sentAt: "desc" }],
      include: {
        client: { select: { name: true } },
        transaction: { select: { propertyAddress: true } },
      },
    }),
  );

  const answered = reviews.filter((r) => r.answeredAt);
  const pending = reviews.filter((r) => !r.answeredAt && !r.revokedAt);
  const bizAvg = businessAverage(answered);
  const standings = coordinatorStandings(answered);
  const publicComments = answered.filter((r) => r.publishAllowed && r.comment);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-stone-900">Reviews</h1>
        <p className="mt-1 text-sm text-stone-500">
          What clients said after closing. Sent automatically a few days after each file closes —
          wording and timing live under{" "}
          <Link href="/dashboard/emails" className="text-brand-700 hover:underline">
            Email templates
          </Link>
          , per-client on/off on each client's page.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Overall rating
          </p>
          {bizAvg === null ? (
            <p className="mt-2 text-sm text-stone-400">No answers yet</p>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums text-stone-900">
                {bizAvg.toFixed(1)}
              </span>
              <Stars value={bizAvg} />
            </div>
          )}
          <p className="mt-1 text-xs text-stone-400">{answered.length} answered</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Awaiting reply
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-stone-900">{pending.length}</p>
          <p className="mt-1 text-xs text-stone-400">sent, not yet answered</p>
        </div>
        <div className={card}>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            Ready to quote
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-stone-900">
            {publicComments.length}
          </p>
          <p className="mt-1 text-xs text-stone-400">answered with consent to publish</p>
        </div>
      </div>

      <div
        className={`grid gap-4 lg:items-start ${standings.length > 0 ? "lg:grid-cols-[20rem_1fr]" : ""}`}
      >
        {standings.length > 0 && (
          <section className={card}>
            <h2 className="mb-3 font-medium">By coordinator</h2>
            <div className="flex flex-col divide-y divide-stone-100">
              {standings.map((s) => (
                <div
                  key={s.coordinatorId ?? s.coordinatorName}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-medium text-stone-800">{s.coordinatorName}</span>
                  <span className="flex items-center gap-2">
                    <Stars value={s.average} />
                    <span className="tabular-nums text-stone-500">{s.average.toFixed(1)}</span>
                    <span className="text-xs text-stone-400">({s.count})</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className="mb-3 font-medium">Recent answers</h2>
          {answered.length === 0 ? (
            <p className="text-sm text-stone-400">Nothing answered yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-stone-100">
              {answered.slice(0, 25).map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-800">{r.client.name}</span>
                    <span className="text-xs text-stone-400">{r.transaction.propertyAddress}</span>
                    {r.businessRating && <Stars value={r.businessRating} />}
                    {r.publishAllowed && (
                      <Badge tone="success">
                        <span className="text-[10px]">Quotable</span>
                      </Badge>
                    )}
                  </div>
                  {r.comment && <p className="text-stone-600">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
