import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isOperator } from "@/lib/operator";
import { tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Every "recommend Freehold" email sent from the public /recommend page's
 * send-it-for-you form, and whether the recipient ever opened the tracked
 * link. Read-only — there's nothing to configure here, just visibility.
 */
export default async function AdminRecommendationsPage() {
  if (!(await isOperator())) notFound();

  const rows = await prisma.friendRecommendation.findMany({
    orderBy: { sentAt: "desc" },
    take: 500,
  });
  const clicked = rows.filter((r) => r.clickedAt).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Recommendations</h1>
        <p className="text-sm text-stone-500">
          Every email sent from /recommend's "send them the demo" form.{" "}
          {rows.length > 0 && `${clicked} of ${rows.length} opened the link.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">Nothing sent yet.</p>
      ) : (
        <div className={tableWrap}>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className={th}>Sent to</th>
                <th className={th}>Sent</th>
                <th className={th}>Clicked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trHover}>
                  <td className={td}>{r.email}</td>
                  <td className={td}>{r.sentAt.toLocaleString()}</td>
                  <td className={td}>
                    {r.clickedAt ? (
                      <span className="text-stone-700">{r.clickedAt.toLocaleString()}</span>
                    ) : (
                      <span className="text-stone-300">Not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
