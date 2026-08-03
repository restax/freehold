import { withTenant } from "@freehold/db";
import {
  type Buildings,
  FileDashed,
  FilePlus,
  Globe,
  House,
  Signpost,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Fragment } from "react";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { createForm } from "@/lib/actions/forms";
import { FORM_KIND_LABEL, FORM_KINDS, layoutFields, parseLayout } from "@/lib/form-schema";
import { FORM_TEMPLATES } from "@/lib/form-templates";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, typeof Buildings> = {
  client_intake: UsersThree,
  transaction_intake: House,
  listing_intake: Signpost,
};

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ takenBy?: string; takenKind?: string }>;
}) {
  const { takenBy, takenKind } = await searchParams;
  const { tenantId } = await requireTenant();
  const [forms, pending] = await withTenant(tenantId, async (tx) => [
    await tx.form.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    }),
    await tx.formSubmission.count({ where: { status: "new" } }),
  ]);
  // The shared form of each kind, if the workspace already has one.
  const sharedByKind = new Map(forms.filter((f) => f.clientId === null).map((f) => [f.kind, f]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Forms</h1>
          <p className="text-sm text-stone-500">
            Intake forms you design and place. A published form appears wherever you've pointed it —
            your public website, your clients' portals, or both.
          </p>
        </div>
        <Link
          href="/dashboard/forms/submissions"
          className={`${btnGhost} flex items-center gap-2 whitespace-nowrap`}
        >
          Submissions
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900">
              {pending}
            </span>
          )}
        </Link>
      </div>

      {takenBy && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You already have a {takenKind ?? "form"} form.{" "}
          <Link href={`/dashboard/forms/${takenBy}`} className="font-medium underline">
            Edit the one you have
          </Link>{" "}
          — or delete it first if you'd rather start again from a template.
        </p>
      )}

      <SectionCard
        tour="forms-templates"
        title="Start from a template"
        icon={<FilePlus size={15} weight="fill" aria-hidden />}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {FORM_TEMPLATES.map((t) => {
            const Icon = KIND_ICON[t.kind] ?? FileDashed;
            const existing = sharedByKind.get(t.kind);
            return (
              <form
                key={t.id}
                action={createForm}
                className="flex flex-col gap-1.5 rounded-lg border border-stone-200 p-3 transition-colors hover:border-brand-300"
              >
                <input type="hidden" name="templateId" value={t.id} />
                <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
                  <Icon size={14} className="shrink-0 text-stone-400" aria-hidden />
                  {t.name}
                </span>
                <span className="flex-1 text-xs leading-relaxed text-stone-500">
                  {t.description}
                </span>
                <span className="flex items-center gap-2">
                  <input
                    name="name"
                    aria-label={`Name for ${t.name}`}
                    defaultValue={t.name}
                    className={`${input} min-w-0 flex-1 py-1 text-xs`}
                  />
                  <button type="submit" className={`${btn} shrink-0 px-2.5 py-1 text-xs`}>
                    Use this
                  </button>
                </span>
                {/* One shared form per kind, so say so before the click
                    rather than after it. */}
                {existing && (
                  <span className="text-[11px] text-amber-700">
                    You already have a {FORM_KIND_LABEL[t.kind]?.toLowerCase()} form.
                  </span>
                )}
              </form>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          A template is only a starting point — once it's yours, every question, heading and answer
          is editable in the designer.
        </p>
      </SectionCard>

      <section className={card}>
        {forms.length === 0 ? (
          <EmptyState
            title="No forms yet"
            hint="Design a new-client or new-transaction form above. Drag fields into the order you want, publish it, and it shows up on your website and in client portals — no linking required."
          />
        ) : (
          <div className={tableWrap}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th}>Form</th>
                  <th className={th}>Status</th>
                  <th className={th}>Appears</th>
                  <th className={th}>Fields</th>
                  <th className={th}>Submissions</th>
                  <th className={th}>Updated</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {FORM_KINDS.map((kind) => {
                  const members = forms.filter((f) => f.kind === kind);
                  if (members.length === 0) return null;
                  const Icon = KIND_ICON[kind] ?? FileDashed;
                  return (
                    <Fragment key={kind}>
                      <tr>
                        <td
                          colSpan={7}
                          className="border-b border-stone-200 bg-stone-50 px-2.5 py-1.5"
                        >
                          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                            <Icon size={13} className="text-stone-400" aria-hidden />
                            {FORM_KIND_LABEL[kind]}
                            <span className="font-normal text-stone-400">{members.length}</span>
                          </span>
                        </td>
                      </tr>
                      {members.map((f) => {
                        const fields = layoutFields(parseLayout(f.layout)).length;
                        return (
                          <tr key={f.id} className={trHover}>
                            <td className={`${td} font-medium`}>
                              <Link
                                href={`/dashboard/forms/${f.id}`}
                                className="text-brand-700 hover:text-brand-600 hover:underline"
                              >
                                {f.name}
                              </Link>
                              {f.client && (
                                <span className="ml-2 text-xs font-normal text-stone-400">
                                  private to {f.client.name}
                                </span>
                              )}
                            </td>
                            <td className={td}>
                              <Badge tone={f.status === "published" ? "success" : "neutral"}>
                                {f.status === "published" ? "Published" : "Draft"}
                              </Badge>
                            </td>
                            <td className={td}>
                              <span className="flex items-center gap-2 text-xs text-stone-500">
                                {f.showPublic && (
                                  <span className="flex items-center gap-1">
                                    <Globe size={12} className="text-stone-400" aria-hidden />
                                    Website
                                  </span>
                                )}
                                {f.showPortal && (
                                  <span className="flex items-center gap-1">
                                    <UsersThree size={12} className="text-stone-400" aria-hidden />
                                    Portals
                                  </span>
                                )}
                                {!f.showPublic && !f.showPortal && (
                                  <span className="text-stone-300">Internal only</span>
                                )}
                              </span>
                            </td>
                            <td className={td}>{fields}</td>
                            <td className={td}>{f._count.submissions}</td>
                            <td className={td}>{fmtDate(f.updatedAt)}</td>
                            <td className={td}>
                              <Link
                                href={`/dashboard/forms/${f.id}`}
                                className="whitespace-nowrap text-xs text-brand-700 hover:underline"
                              >
                                Design →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
