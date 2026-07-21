import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { markInboundHandled } from "@/lib/actions/inbound";
import { fmtDate } from "@/lib/format";
import { isOperator } from "@/lib/operator";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * The inbound landing zone: replies that couldn't be threaded — no reply token,
 * or a token matching nothing. They used to be dropped with a 200 and no trace;
 * now they're captured here so a vendor's reply never silently vanishes.
 * inbound_email has no RLS (unmatched mail may belong to no tenant), so this is
 * a single bare query, gated to operators.
 */
export default async function AdminInboundPage() {
  if (!(await isOperator())) notFound();

  const rows = await prisma.inboundEmail.findMany({
    orderBy: [{ handledAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const pending = rows.filter((r) => !r.handledAt);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="text-xl font-semibold">Unmatched inbound email</h1>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pending.length} pending
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">
          Nothing captured — every inbound reply matched a thread.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <section
              key={r.id}
              className={`${card} ${r.handledAt ? "opacity-60" : ""}`}
              data-handled={Boolean(r.handledAt)}
            >
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{r.fromAddr}</span>
                <span className="text-stone-400">→ {r.toAddr}</span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                  {r.reason === "no_token" ? "no reply token" : "unknown token"}
                </span>
                {r.attachmentCount > 0 && (
                  <span className="text-xs text-stone-500">📎 {r.attachmentCount}</span>
                )}
                <span className="text-xs text-stone-400">{fmtDate(r.createdAt)}</span>
                {r.handledAt ? (
                  <span className="ml-auto text-xs text-stone-400">handled</span>
                ) : (
                  <form action={markInboundHandled} className="ml-auto">
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-xs text-brand-600 hover:underline">
                      Mark handled
                    </button>
                  </form>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-600">{r.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-500">
                {r.bodyText.slice(0, 500)}
              </p>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
