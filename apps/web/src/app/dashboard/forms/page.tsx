import { withTenant } from "@freehold/db";
import {
  type Buildings,
  FileDashed,
  Globe,
  House,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Fragment } from "react";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { createForm } from "@/lib/actions/forms";
import {
  FORM_KIND_LABEL,
  FORM_KINDS,
  type FormKind,
  layoutFields,
  parseLayout,
} from "@/lib/form-schema";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, typeof Buildings> = {
  client_intake: UsersThree,
  transaction_intake: House,
};

export default async function FormsPage() {
  const { tenantId } = await requireTenant();
  const forms = await withTenant(tenantId, (tx) =>
    tx.form.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Forms</h1>
        <p className="text-sm text-stone-500">
          Intake forms you design and place. A published form appears wherever you've pointed it —
          your public website, your clients' portals, or both.
        </p>
      </div>

      <section className={card}>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">
          New form
        </p>
        <div className="flex flex-wrap gap-2">
          {FORM_KINDS.map((kind: FormKind) => {
            const Icon = KIND_ICON[kind] ?? FileDashed;
            return (
              <form key={kind} action={createForm} className="flex items-end gap-2">
                <input type="hidden" name="kind" value={kind} />
                <label className={label}>
                  <span className="flex items-center gap-1.5">
                    <Icon size={13} className="text-stone-400" aria-hidden />
                    {FORM_KIND_LABEL[kind]}
                  </span>
                  <input
                    name="name"
                    className={`${input} w-56`}
                    placeholder={`${FORM_KIND_LABEL[kind]} form`}
                  />
                </label>
                <button type="submit" className={btn}>
                  Create
                </button>
              </form>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Starts from a sensible default you can rearrange — not a blank page.
        </p>
      </section>

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
