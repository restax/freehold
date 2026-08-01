import {
  CalendarCheck,
  DownloadSimple,
  FileText,
  ListChecks,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { portalVars, tenantAppearance } from "@/lib/appearance";
import { fmtDate, fmtMoney, ROLE_LABEL } from "@/lib/format";
import { resolveAgentPortalTxn } from "@/lib/portal";
import { portalGroups } from "@/lib/portal-attachments";
import { sideLabel, tenantSideLabels } from "@/lib/side-labels";

export const dynamic = "force-dynamic";

const cardCls =
  "rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]";

/** One transaction, seen through the managed-agent portal. */
export default async function AgentPortalTxnPage({
  params,
}: {
  params: Promise<{ token: string; txnId: string }>;
}) {
  const { token, txnId } = await params;
  const portal = await resolveAgentPortalTxn(token, txnId);
  const labels = await tenantSideLabels(portal?.link.tenantId ?? "");
  if (!portal) notFound();
  const { link, txn, tenantName } = portal;
  const appearance = await tenantAppearance(link.tenantId);
  const today = fmtDate(new Date());
  const doneCount = txn.tasks.filter((t) => t.status === "DONE").length;
  // What this client may see, grouped the way the coordinator filed it. The
  // rules for "may see" live in lib/portal-attachments.ts.
  const fileGroups = portalGroups(txn.attachments, txn.attachmentFolders, "agent");
  const sharedCount = fileGroups.reduce((n, g) => n + g.shared.length, 0);

  return (
    <main
      className="min-h-screen bg-stone-50"
      style={{ ...portalVars(appearance), fontFamily: "var(--font-sans)" }}
    >
      <header
        className="pb-14 pt-8 text-white"
        style={{
          background:
            "radial-gradient(100% 140% at 50% 0%, var(--portal-accent) 0%, var(--portal-accent-dark) 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <Link
            href={`/portal/${token}`}
            className="text-xs font-medium uppercase tracking-[0.18em] text-brand-200 hover:text-white"
          >
            ← All your transactions
          </Link>
          <h1 className="font-display mt-2 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">
            {txn.propertyAddress}
          </h1>
          <p className="mt-1 text-sm text-brand-50/80">
            {[txn.city, txn.state, txn.zip].filter(Boolean).join(", ")}
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-8 flex max-w-3xl flex-col gap-5 px-4 pb-10">
        <section className={cardCls}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Status</dt>
              <dd>
                <StatusBadge status={txn.status} />
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Side</dt>
              <dd className="font-medium">{sideLabel(txn.side, labels)}</dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Closing date</dt>
              <dd className="flex items-center gap-1.5 font-medium tabular-nums">
                <CalendarCheck size={15} weight="fill" className="text-brand-600" aria-hidden />
                {fmtDate(txn.closeDate)}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-stone-400">Price</dt>
              <dd className="font-medium tabular-nums">{fmtMoney(txn.purchasePrice)}</dd>
            </div>
          </dl>
        </section>

        {txn.tasks.length > 0 && (
          <section className={cardCls}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 font-medium">
                <ListChecks size={17} weight="bold" className="text-brand-600" aria-hidden />
                Tasks &amp; dates
              </h2>
              <span className="text-xs tabular-nums text-stone-400">
                {doneCount} of {txn.tasks.length} done
              </span>
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

        <section className={cardCls}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-medium">
              <FileText size={17} weight="bold" className="text-brand-600" aria-hidden />
              Files
            </h2>
            {sharedCount > 0 && (
              <a
                href={`/portal/${token}/t/${txn.id}/zip`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700"
              >
                <DownloadSimple size={14} weight="bold" aria-hidden />
                Download all (ZIP)
              </a>
            )}
          </div>
          {fileGroups.length === 0 ? (
            <p className="text-sm text-stone-500">No files shared on this transaction yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {fileGroups.map((group) => (
                <div key={group.folderId ?? "loose"}>
                  {/* The heading is dropped when everything sits loose —
                      one group called "Files" under a card already called
                      "Files" is noise. */}
                  {(fileGroups.length > 1 || group.folderId) && (
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {group.name}
                    </h3>
                  )}
                  <ul className="flex flex-col gap-1 text-sm">
                    {group.shared.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`/portal/${link.token}/documents/${item.document?.id}`}
                          className="text-brand-600 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.document?.filename}
                        </a>{" "}
                        <span className="text-xs text-stone-400">
                          ({((item.document?.sizeBytes ?? 0) / 1024).toFixed(0)} KB)
                        </span>
                      </li>
                    ))}
                    {/* What the file is still waiting on, where the
                        coordinator chose to say so. Named plainly rather
                        than styled as a warning: this is usually a nudge,
                        not a problem. */}
                    {group.awaiting.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-stone-500">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full border border-stone-300"
                        />
                        {item.label}
                        <span className="text-xs text-stone-400">still needed</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {txn.parties.length > 0 && (
          <section className={cardCls}>
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <UsersThree size={17} weight="bold" className="text-brand-600" aria-hidden />
              Who's involved
            </h2>
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

        <section className={cardCls}>
          <h2 className="mb-2 font-medium">Showings &amp; activity</h2>
          <p className="text-sm text-stone-500">
            Showing feedback lands here once a showing service is connected — it's on the
            integrations roadmap. Ask {tenantName} to prioritize yours.
          </p>
        </section>

        <footer className="mt-2 text-center text-xs text-stone-400">
          Coordinated by {tenantName} · powered by{" "}
          <a
            href="https://freeholdtc.dev"
            className="font-medium text-stone-500 hover:text-brand-700"
          >
            Freehold
          </a>
        </footer>
      </div>
    </main>
  );
}
