import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { createTemplate, saveEmailTemplates } from "@/lib/actions/templates";
import { EMAIL_MERGE_CODES, parseEmailTemplates } from "@/lib/email-template";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { tenantId } = await requireTenant();
  const templates = await withTenant(tenantId, (tx) =>
    tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
  );
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailTemplates: true },
  });
  const emailTemplates = parseEmailTemplates(org.emailTemplates);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Document templates</h1>
        <p className="text-sm text-stone-500">
          Reusable letters and forms with merge fields like{" "}
          <code>{"{{transaction.closeDate}}"}</code> — generate a filled PDF on any transaction.
        </p>
      </div>

      <details className={card}>
        <summary className={summaryLink}>New template</summary>
        <form action={createTemplate} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={label}>
            Name *
            <input name="name" required className={input} placeholder="Closing intro letter" />
          </label>
          <label className={`${label} min-w-64 flex-1`}>
            Description
            <input name="description" className={input} />
          </label>
          <button type="submit" className={btn}>
            Create & edit
          </button>
        </form>
      </details>

      <section className={card}>
        {templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            hint="Write a letter or form once with merge fields, then generate a filled PDF from any transaction in one click."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Description</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/templates/${t.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className={td}>{t.description ?? "—"}</td>
                  <td className={td}>{fmtDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Automated email templates</h2>
        <p className="mb-1 text-sm text-stone-500">
          The wording of the lifecycle emails Freehold sends for you — the intro when a file opens
          and the congratulations after closing. Per-client on/off switches live on each client's
          page.
        </p>
        <p className="mb-4 text-xs text-stone-400">
          Merge codes:{" "}
          {EMAIL_MERGE_CODES.map((c) => (
            <code key={c} className="mr-2">
              {c}
            </code>
          ))}
        </p>
        <form action={saveEmailTemplates} className="flex flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-stone-700">Intro email</h3>
              <label className={label}>
                Subject
                <input
                  name="introSubject"
                  defaultValue={emailTemplates.intro.subject}
                  className={input}
                />
              </label>
              <label className={label}>
                Body
                <textarea
                  name="introBody"
                  rows={8}
                  defaultValue={emailTemplates.intro.body}
                  className={input}
                />
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-stone-700">Post-close email</h3>
              <label className={label}>
                Subject
                <input
                  name="postCloseSubject"
                  defaultValue={emailTemplates.postClose.subject}
                  className={input}
                />
              </label>
              <label className={label}>
                Body
                <textarea
                  name="postCloseBody"
                  rows={8}
                  defaultValue={emailTemplates.postClose.body}
                  className={input}
                />
              </label>
            </div>
          </div>
          <button type="submit" className={`${btn} self-start`}>
            Save email templates
          </button>
        </form>
      </section>
    </div>
  );
}
