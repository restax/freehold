import { prisma } from "@freehold/db";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { adminResolveError } from "@/lib/actions/error-log";
import { isOperator } from "@/lib/operator";
import { td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

function when(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Operator view of errors people ran into: who, which page, what they were
 * doing, and the message. `?q=` narrows to an email, page or message
 * fragment; `?all=1` includes handled ones.
 */
export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { q: rawQ, all } = await searchParams;
  const q = (rawQ ?? "").trim();

  const rows = await prisma.errorLog.findMany({
    where: {
      ...(all === "1" ? {} : { resolvedAt: null }),
      ...(q
        ? {
            OR: [
              { userEmail: { contains: q, mode: "insensitive" } },
              { path: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
              { digest: q },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Errors"
        count={rows.length}
        action={
          <form method="get" className="flex items-center gap-1.5">
            {all === "1" && <input type="hidden" name="all" value="1" />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search email, page, message or reference"
              className="w-72 rounded border border-stone-300 px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
            >
              Search
            </button>
            <a
              href={all === "1" ? "/admin/errors" : "/admin/errors?all=1"}
              className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
            >
              {all === "1" ? "Open only" : "Include handled"}
            </a>
          </form>
        }
        bodyClassName=""
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Person</th>
                <th className={th}>Page</th>
                <th className={th}>Doing</th>
                <th className={th}>What happened</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className={`${td} text-stone-400`} colSpan={6}>
                    No errors recorded.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={`${trHover} align-top`}>
                  <td className={`${td} whitespace-nowrap`}>
                    {when(r.createdAt)}
                    <span className="block text-xs text-stone-400">{r.source}</span>
                  </td>
                  <td className={td}>
                    {r.userEmail ? (
                      <a
                        href={`/admin/signups?q=${encodeURIComponent(r.userEmail)}`}
                        className="hover:underline"
                      >
                        {r.userEmail}
                      </a>
                    ) : (
                      <span className="text-stone-300">unknown</span>
                    )}
                  </td>
                  <td className={`${td} max-w-56 break-words font-mono text-xs`}>{r.path ?? ""}</td>
                  <td className={td}>{r.action ?? ""}</td>
                  <td className={`${td} max-w-md`}>
                    <p className="break-words">{r.message}</p>
                    {r.digest && (
                      <a
                        href={`/admin/errors?all=1&q=${r.digest}`}
                        className="font-mono text-xs text-stone-400 hover:underline"
                      >
                        ref {r.digest}
                      </a>
                    )}
                    <details className="mt-1 text-xs text-stone-500">
                      <summary className="cursor-pointer">Details</summary>
                      {r.detail != null && (
                        <pre className="mt-1 whitespace-pre-wrap">
                          {JSON.stringify(r.detail, null, 2)}
                        </pre>
                      )}
                      {r.userAgent && <p className="mt-1 break-words">{r.userAgent}</p>}
                      {r.stack && (
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">
                          {r.stack}
                        </pre>
                      )}
                    </details>
                  </td>
                  <td className={td}>
                    {r.resolvedAt ? (
                      <form action={adminResolveError} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="reopen" value="1" />
                        <span className="text-xs text-stone-500">{r.note ?? "Handled"}</span>
                        <button
                          type="submit"
                          className="w-fit rounded border border-stone-300 px-1.5 py-0.5 text-xs hover:bg-stone-50"
                        >
                          Reopen
                        </button>
                      </form>
                    ) : (
                      <form action={adminResolveError} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          name="note"
                          placeholder="Cause (optional)"
                          className="w-32 rounded border border-stone-300 px-1.5 py-0.5 text-xs focus:border-brand-600 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded border border-stone-300 px-1.5 py-0.5 text-xs hover:bg-stone-50"
                        >
                          Handled
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
