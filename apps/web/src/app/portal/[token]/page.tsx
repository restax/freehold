import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { fmtDate, fmtMoney, ROLE_LABEL, SIDE_LABEL } from "@/lib/format";
import { resolvePortal } from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Public, read-only client portal. The token in the URL is the capability. */
export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await resolvePortal(token);
  if (!portal) notFound();
  const { link, txn, tenantName } = portal;
  const today = fmtDate(new Date());

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-4 py-8">
      <header className="pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-700">{tenantName}</p>
        <h1 className="mt-1 text-balance text-3xl font-semibold tracking-tight">
          {txn.propertyAddress}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {[txn.city, txn.state, txn.zip].filter(Boolean).join(", ")}
        </p>
      </header>

      <section className="rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Status</dt>
            <dd>
              <StatusBadge status={txn.status} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Side</dt>
            <dd className="font-medium">{SIDE_LABEL[txn.side]}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Contract date</dt>
            <dd className="font-medium tabular-nums">{fmtDate(txn.contractDate)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Closing date</dt>
            <dd className="font-medium tabular-nums">{fmtDate(txn.closeDate)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Purchase price</dt>
            <dd className="font-medium tabular-nums">{fmtMoney(txn.purchasePrice)}</dd>
          </div>
        </dl>
      </section>

      {link.showTasks && Array.isArray(txn.tasks) && txn.tasks.length > 0 && (
        <section className="rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Progress</h2>
            <span className="text-xs tabular-nums text-stone-400">
              {txn.tasks.filter((t) => t.status === "DONE").length} of {txn.tasks.length} steps done
            </span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{
                width: `${Math.round((txn.tasks.filter((t) => t.status === "DONE").length / txn.tasks.length) * 100)}%`,
              }}
            />
          </div>
          <ul className="flex flex-col">
            {txn.tasks.map((t) => {
              const done = t.status === "DONE";
              const overdue = !done && t.dueDate && fmtDate(t.dueDate) < today;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      done
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-stone-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={done ? "text-stone-400 line-through" : ""}>{t.title}</span>
                  <span
                    className={`ml-auto shrink-0 ${overdue ? "font-medium text-red-600" : "text-stone-400"}`}
                  >
                    {fmtDate(t.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {link.showParties && Array.isArray(txn.parties) && txn.parties.length > 0 && (
        <section className="rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
          <h2 className="mb-3 font-medium">Who's involved</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {txn.parties.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-2">
                <span className="w-32 shrink-0 text-stone-500">{ROLE_LABEL[p.role]}</span>
                <span className="font-medium">{p.contact.name}</span>
                <span className="text-stone-500">{p.contact.email ?? p.contact.phone ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {link.showDocuments && Array.isArray(txn.documents) && txn.documents.length > 0 && (
        <section className="rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
          <h2 className="mb-3 font-medium">Documents</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {txn.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={`/portal/${link.token}/documents/${d.id}`}
                  className="text-brand-600 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {d.filename}
                </a>{" "}
                <span className="text-xs text-stone-400">
                  ({(d.sizeBytes / 1024).toFixed(0)} KB)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-2 text-center text-xs text-stone-400">
        Shared by {tenantName} · read-only view · powered by Freehold
      </footer>
    </main>
  );
}
