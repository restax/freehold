import { prisma, type StateClosingModel } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { seedStateReferences, setLicenseGeneralRule } from "@/lib/actions/state-reference";
import { isOperator } from "@/lib/operator";
import { btn, btnGhost, card, input, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const MODEL_LABEL: Record<StateClosingModel, string> = {
  TITLE_ESCROW: "Title / escrow",
  ATTORNEY: "Attorney",
  PARTIAL_ATTORNEY: "Partial attorney",
};

/**
 * Cross-tenant reference notes every workspace benefits from: closing
 * process, dominant MLS systems, TC licensing norms, and jargon per state.
 * Informational only — see StateReference in schema.prisma for why this
 * never touches a workspace's own Operating-states declaration.
 */
export default async function AdminStatesPage() {
  if (!(await isOperator())) notFound();

  const [states, setting] = await Promise.all([
    prisma.stateReference.findMany({ orderBy: { name: "asc" } }),
    prisma.platformSetting.findUnique({
      where: { id: "singleton" },
      select: { tcLicenseGeneralRule: true },
    }),
  ]);
  const unverifiedCount = states.filter((s) => !s.verified).length;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-brand-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-1 text-xl font-semibold">State reference</h1>
          <p className="text-sm text-stone-500">
            Closing model, dominant MLS, TC licensing norms, and jargon per state — shown to tenants
            as a reference next to their own Operating states. Editable here only.
          </p>
        </div>
        {states.length === 0 && (
          <form action={seedStateReferences}>
            <button type="submit" className={btn}>
              Seed all 50 states
            </button>
          </form>
        )}
      </div>

      <section className={card}>
        <h2 className="mb-2 font-medium">General rule on TC licensing</h2>
        <p className="mb-3 text-xs text-stone-400">
          Shown above the per-state table wherever this data is surfaced — the baseline that applies
          before any state-specific note.
        </p>
        <form action={setLicenseGeneralRule} className="flex flex-col gap-3">
          <textarea
            name="rule"
            rows={3}
            defaultValue={setting?.tcLicenseGeneralRule ?? ""}
            className={`${input} resize-y`}
          />
          <button type="submit" className={`${btnGhost} w-fit`}>
            Save
          </button>
        </form>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-medium">All states</h2>
          <span className="text-xs text-stone-400">{states.length} of 50</span>
          {unverifiedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {unverifiedCount} unverified
            </span>
          )}
        </div>
        {states.length === 0 ? (
          <p className="text-sm text-stone-400">
            Nothing seeded yet — click "Seed all 50 states" above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={th}>State</th>
                  <th className={th}>Closing model</th>
                  <th className={th}>Dominant MLS</th>
                  <th className={th}>Verified</th>
                </tr>
              </thead>
              <tbody>
                {states.map((s) => (
                  <tr key={s.code} className={trHover}>
                    <td className={td}>
                      <Link
                        href={`/admin/states/${s.code}`}
                        className="font-medium text-brand-700 hover:text-brand-600"
                      >
                        {s.name}
                      </Link>
                      <span className="ml-1.5 text-xs text-stone-400">{s.code}</span>
                    </td>
                    <td className={td}>{MODEL_LABEL[s.closingModel]}</td>
                    <td className={`${td} max-w-xs truncate`}>{s.dominantMls}</td>
                    <td className={td}>
                      {s.verified ? (
                        <span className="text-stone-700">Yes</span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
