import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { DangerDelete } from "@/components/danger-delete";
import { TemplateEditor } from "@/components/template-editor";
import {
  createEmailTemplateLib,
  deleteEmailTemplateLib,
  saveEmailSettings,
  saveEmailTemplates,
  updateEmailTemplateLib,
} from "@/lib/actions/templates";
import { EMAIL_MERGE_CODES, parseEmailSettings, parseEmailTemplates } from "@/lib/email-template";
import { EMAIL_CATEGORY_LABELS } from "@/lib/email-template-library";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, card, input, label as labelCls, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["STATUS", "INTRO", "PORTAL", "MILESTONE", "LISTING", "POST_CLOSE", "OTHER"];

export default async function EmailTemplatesPage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const templates = await withTenant(tenantId, (tx) =>
    tx.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  );
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailTemplates: true, emailSettings: true },
  });
  const automated = parseEmailTemplates(org.emailTemplates);
  const settings = parseEmailSettings(org.emailSettings);

  const grouped = CATEGORY_ORDER.map(
    (cat) => [cat, templates.filter((t) => t.category === cat)] as const,
  ).filter(([, list]) => list.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Email templates</h1>
        <p className="text-sm text-stone-500">
          Every email your workspace sends starts here: reusable templates (one click away from any
          task), the automated lifecycle emails, and your signature and footer. Looking for PDF
          letters?{" "}
          <Link href="/dashboard/templates" className="text-brand-700 hover:underline">
            Doc templates →
          </Link>
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Merge fields fill from the transaction when sent: {EMAIL_MERGE_CODES.join(" ")}
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-1 font-medium">Signature &amp; footer</h2>
        <p className="mb-4 text-sm text-stone-500">
          Appended to every outgoing email — change it once here and it changes everywhere,
          including the automated emails.
        </p>
        <form action={saveEmailSettings} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">Signature</span>
            <TemplateEditor name="signature" defaultValue={settings.signature} rows={4} />
          </div>
          <label className={labelCls}>
            Footer line
            <input
              name="footer"
              defaultValue={settings.footer}
              placeholder="Acme Transactions · 123 Main St, Springfield IL · (555) 010-1234"
              className={input}
            />
          </label>
          {isAdmin ? (
            <button type="submit" className={`${btn} self-start`}>
              Save signature &amp; footer
            </button>
          ) : (
            <p className="text-sm text-stone-400">Only workspace admins can edit these.</p>
          )}
        </form>
      </section>

      <details className={card}>
        <summary className={summaryLink}>+ New email template</summary>
        <form action={createEmailTemplateLib} className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelCls}>
              Name *
              <input name="name" required placeholder="Appraisal came in low" className={input} />
            </label>
            <label className={labelCls}>
              Category
              <select name="category" className={input} defaultValue="MILESTONE">
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {EMAIL_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Suggest on tasks containing
              <input name="taskMatch" placeholder="appraisal, valuation" className={input} />
            </label>
            <label className={labelCls}>
              Subject *
              <input
                name="subject"
                required
                placeholder="About the appraisal — {{property_address}}"
                className={input}
              />
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">Body *</span>
            <TemplateEditor name="body" rows={8} />
          </div>
          <button type="submit" className={`${btn} self-start`}>
            Create template
          </button>
        </form>
      </details>

      {grouped.map(([cat, list]) => (
        <section key={cat} className={card}>
          <h2 className="mb-3 font-medium">{EMAIL_CATEGORY_LABELS[cat]}</h2>
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t.id} className="rounded-lg border border-stone-200/70">
                <details>
                  <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-3 px-4 py-2.5 text-sm hover:bg-stone-50">
                    <span className="font-medium">{t.name.replace(" (Sample)", "")}</span>
                    <span className="text-stone-400">{t.subject}</span>
                    {t.taskMatch && (
                      <span className="ml-auto text-xs text-stone-400">
                        suggested on: {t.taskMatch}
                      </span>
                    )}
                  </summary>
                  <div className="border-t border-stone-100 p-4">
                    <form action={updateEmailTemplateLib} className="flex flex-col gap-3">
                      <input type="hidden" name="id" value={t.id} />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className={labelCls}>
                          Name
                          <input name="name" defaultValue={t.name} required className={input} />
                        </label>
                        <label className={labelCls}>
                          Category
                          <select name="category" defaultValue={t.category} className={input}>
                            {CATEGORY_ORDER.map((c) => (
                              <option key={c} value={c}>
                                {EMAIL_CATEGORY_LABELS[c]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={labelCls}>
                          Suggest on tasks containing
                          <input
                            name="taskMatch"
                            defaultValue={t.taskMatch ?? ""}
                            className={input}
                          />
                        </label>
                        <label className={labelCls}>
                          Subject
                          <input
                            name="subject"
                            defaultValue={t.subject}
                            required
                            className={input}
                          />
                        </label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-stone-700">Body</span>
                        <TemplateEditor name="body" defaultValue={t.body} rows={10} />
                      </div>
                      <button type="submit" className={`${btn} self-start`}>
                        Save
                      </button>
                    </form>
                    <div className="mt-3">
                      <DangerDelete
                        action={deleteEmailTemplateLib}
                        label="Delete this email template"
                        description={`Removes "${t.name}". Sent emails are unaffected. This cannot be undone.`}
                        hidden={{ id: t.id }}
                      />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className={card}>
        <h2 className="mb-1 font-medium">Automated emails</h2>
        <p className="mb-4 text-sm text-stone-500">
          Sent for you: the intro when a file opens and the congratulations after closing.
          Per-client on/off switches live on each client's page.
        </p>
        <form action={saveEmailTemplates} className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-stone-700">Intro email</h3>
              <label className={labelCls}>
                Subject
                <input
                  name="introSubject"
                  defaultValue={automated.intro.subject}
                  className={input}
                />
              </label>
              <span className="text-sm font-medium text-stone-700">Body</span>
              <TemplateEditor name="introBody" defaultValue={automated.intro.body} rows={8} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-stone-700">Post-close email</h3>
              <label className={labelCls}>
                Subject
                <input
                  name="postCloseSubject"
                  defaultValue={automated.postClose.subject}
                  className={input}
                />
              </label>
              <span className="text-sm font-medium text-stone-700">Body</span>
              <TemplateEditor
                name="postCloseBody"
                defaultValue={automated.postClose.body}
                rows={8}
              />
            </div>
          </div>
          <button type="submit" className={`${btn} self-start`}>
            Save automated emails
          </button>
        </form>
      </section>
    </div>
  );
}
