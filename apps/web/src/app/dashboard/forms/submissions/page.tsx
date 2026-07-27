import { withTenant } from "@freehold/db";
import { Paperclip, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import {
  convertSubmission,
  dismissSubmission,
  reopenSubmission,
} from "@/lib/actions/form-submissions";
import {
  FORM_KIND_LABEL,
  isFormKind,
  layoutFields,
  mappedField,
  parseLayout,
  parseParty,
} from "@/lib/form-schema";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, summaryLink, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  new: ["progress", "Needs review"],
  converted: ["success", "Converted"],
  dismissed: ["neutral", "Dismissed"],
} as const;

/** Render an answer the way it was typed, whatever shape it is. */
function answerText(raw: unknown): string {
  const party = parseParty(raw);
  if (party) return [party.name, party.email, party.phone].filter(Boolean).join(" · ");
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  return typeof raw === "string" ? raw : "";
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ convertError?: string; show?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { convertError, show } = await searchParams;
  const showAll = show === "all";

  const submissions = await withTenant(tenantId, (tx) =>
    tx.formSubmission.findMany({
      where: showAll ? {} : { status: "new" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        client: { select: { id: true, name: true } },
        files: { select: { id: true, filename: true, sizeBytes: true } },
      },
    }),
  );
  const pending = submissions.filter((s) => s.status === "new").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Form submissions</h1>
          <p className="text-sm text-stone-500">
            What people sent through your forms. Nothing here is in your pipeline yet — converting
            is what makes a client or a file.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/forms" className="text-sm text-brand-700 hover:underline">
            Forms →
          </Link>
          <Link
            href={
              showAll ? "/dashboard/forms/submissions" : "/dashboard/forms/submissions?show=all"
            }
            className={`${btnGhost} whitespace-nowrap`}
          >
            {showAll ? `Needs review (${pending})` : "Show all"}
          </Link>
        </div>
      </div>

      {convertError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{convertError}</p>
      )}

      <section className={card}>
        {submissions.length === 0 ? (
          <EmptyState
            title={showAll ? "Nothing has come in yet" : "Nothing waiting"}
            hint={
              showAll
                ? "When someone fills in one of your public forms, it lands here for you to look over before anything enters your pipeline."
                : "Everything that's come in has been dealt with. Switch to “Show all” to see what you've already converted or dismissed."
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-stone-100">
            {submissions.map((s) => {
              const [tone, label] = STATUS_TONE[s.status as keyof typeof STATUS_TONE] ?? [
                "neutral",
                s.status,
              ];
              const kind = isFormKind(s.formKind) ? s.formKind : null;
              // The snapshot, not the live form: this is what they actually
              // filled in, whatever the form looks like now.
              const layout = parseLayout(s.schemaSnapshot);
              const values = (s.data ?? {}) as Record<string, unknown>;
              const answered = layoutFields(layout)
                .map((f) => ({ f, text: answerText(values[f.key]) }))
                .filter((a) => a.text !== "");

              return (
                <li key={s.id} className="py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-stone-900">
                      {s.submitterName ?? s.submitterEmail ?? "Unnamed submission"}
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                    {s.client && (
                      <span
                        className="flex items-center gap-1 text-xs font-medium text-brand-800"
                        title="Identified by an emailed link"
                      >
                        <ShieldCheck
                          size={12}
                          weight="fill"
                          className="text-brand-600"
                          aria-hidden
                        />
                        {s.client.name}
                      </span>
                    )}
                    <span className="text-xs text-stone-400">
                      {kind ? FORM_KIND_LABEL[kind] : s.formKind} · {s.formName}
                    </span>
                    {s.files.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-stone-500">
                        <Paperclip size={12} aria-hidden />
                        {s.files.length}
                      </span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-stone-400">
                      {fmtDate(s.createdAt)}
                    </span>
                  </div>

                  {s.submitterEmail && (
                    <p className="mt-0.5 text-xs text-stone-500">{s.submitterEmail}</p>
                  )}

                  <details className="mt-1.5">
                    <summary className={`${summaryLink} text-xs`}>
                      {answered.length} answer{answered.length === 1 ? "" : "s"}
                    </summary>
                    <div className={`${tableWrap} mt-2 rounded-lg bg-stone-50 p-2`}>
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className={th}>Question</th>
                            <th className={th}>Answer</th>
                            <th className={th}>Fills in</th>
                          </tr>
                        </thead>
                        <tbody>
                          {answered.map(({ f, text }) => {
                            const m = kind ? mappedField(kind, f.key) : null;
                            return (
                              <tr key={f.id} className={trHover}>
                                <td className={td}>{f.label}</td>
                                <td className={td}>{text}</td>
                                <td className={`${td} text-xs text-stone-400`}>
                                  {m ? m.binds : "custom — kept in notes"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {s.files.length > 0 && (
                        <p className="px-2.5 pt-2 text-xs text-stone-500">
                          Attached: {s.files.map((f) => f.filename).join(", ")} — added to the file
                          when you convert.
                        </p>
                      )}
                    </div>
                  </details>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {s.status === "new" && (
                      <>
                        <form action={convertSubmission}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className={btn}>
                            {kind === "client_intake" ? "Create client" : "Open the file"}
                          </button>
                        </form>
                        <form action={dismissSubmission}>
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 transition-colors hover:text-red-600"
                          >
                            dismiss
                          </button>
                        </form>
                      </>
                    )}
                    {s.status === "converted" && (
                      <Link
                        href={
                          s.convertedClientId
                            ? `/dashboard/clients/${s.convertedClientId}`
                            : `/dashboard/transactions/${s.convertedTransactionId}`
                        }
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Open what this became →
                      </Link>
                    )}
                    {s.status === "dismissed" && (
                      <form action={reopenSubmission}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className={`${btnGhost} text-xs`}>
                          Put back in the queue
                        </button>
                      </form>
                    )}
                    {s.reviewedByName && s.status !== "new" && (
                      <span className="text-xs text-stone-400">
                        by {s.reviewedByName} {s.reviewedAt ? `· ${fmtDate(s.reviewedAt)}` : ""}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
