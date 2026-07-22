import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { DangerDelete } from "@/components/danger-delete";
import { TemplateEditor } from "@/components/template-editor";
import {
  createEmailTemplateLib,
  deleteEmailTemplateLib,
  restoreDefaultTemplates,
  saveEmailSettings,
  saveEmailTemplates,
  updateEmailTemplateLib,
} from "@/lib/actions/templates";
import { EMAIL_PHASES, phaseOf } from "@/lib/default-email-templates";
import { EMAIL_MERGE_CODES, parseEmailSettings, parseEmailTemplates } from "@/lib/email-template";
import { parseQuietHours } from "@/lib/outbox";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnGhost, card, input, label as labelCls, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";

const HOURS: Array<[number, string]> = Array.from({ length: 24 }, (_, h) => [
  h,
  `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`,
]);

export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ restored?: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { restored } = await searchParams;
  const templates = await withTenant(tenantId, (tx) =>
    tx.emailTemplate.findMany({ orderBy: [{ name: "asc" }] }),
  );
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { emailTemplates: true, emailSettings: true },
  });
  const automated = parseEmailTemplates(org.emailTemplates);
  const settings = parseEmailSettings(org.emailSettings);
  const quiet = parseQuietHours(org.emailSettings);

  // Group by transaction phase; anything with a legacy category falls into General.
  const grouped = EMAIL_PHASES.map(
    (phase) => [phase, templates.filter((t) => phaseOf(t.category) === phase.key)] as const,
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
          <label className={labelCls}>
            CC address for all transactions
            <input
              name="cc"
              type="email"
              defaultValue={settings.cc}
              placeholder="compliance@acme.com"
              className={input}
            />
            <span className="text-xs text-stone-400">
              Automatically CC'd on every email Freehold sends for a transaction, and shown on each
              transaction as a one-click copy for when you email from outside Freehold. Leave blank
              to turn off.
            </span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelCls}>
              Quiet hours start
              <select name="quietStart" defaultValue={quiet.quietStart} className={input}>
                {HOURS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              resume at
              <select name="quietEnd" defaultValue={quiet.quietEnd} className={input}>
                {HOURS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Workspace time zone
              <input name="timeZone" defaultValue={quiet.timeZone} className={input} />
            </label>
            <p className="pb-2 text-xs text-stone-400">
              Automated emails wait out quiet hours — a 2am task completion becomes an 8am email.
            </p>
          </div>
          {isAdmin ? (
            <button type="submit" className={`${btn} self-start`}>
              Save signature &amp; footer
            </button>
          ) : (
            <p className="text-sm text-stone-400">Only workspace admins can edit these.</p>
          )}
        </form>
      </section>

      {restored !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {Number(restored) > 0
            ? `Restored ${restored} default template${restored === "1" ? "" : "s"}.`
            : "You already have every default template."}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          Reusable templates, grouped by transaction phase. One click from any task; edit or delete
          any of them.
        </p>
        {isAdmin && (
          <form action={restoreDefaultTemplates}>
            <button type="submit" className={btnGhost}>
              Restore default templates
            </button>
          </form>
        )}
      </div>

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
              <select name="category" className={input} defaultValue="CONTRACT">
                {EMAIL_PHASES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Suggest on tasks containing
              <input name="taskMatch" placeholder="appraisal, valuation" className={input} />
            </label>
            <label className={labelCls}>
              Pre-attach documents matching
              <input name="attachMatch" placeholder="pre-approval, inspection" className={input} />
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

      {grouped.map(([phase, list]) => (
        <section key={phase.key} className={card}>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="font-medium">{phase.label}</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              {list.length}
            </span>
            <span className="text-xs text-stone-400">{phase.blurb}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {list.map((t) => (
              <li key={t.id} className="rounded-lg border border-stone-200/70">
                <details>
                  <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-3 px-4 py-2.5 text-sm hover:bg-stone-50">
                    <span className="font-medium">{t.name.replace(" (Sample)", "")}</span>
                    <span className="text-stone-400">{t.subject}</span>
                    <span className="ml-auto flex items-center gap-3 text-xs text-stone-400">
                      {t.usageCount > 0 && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5">
                          used {t.usageCount}×
                        </span>
                      )}
                      {t.taskMatch && <span>suggested on: {t.taskMatch}</span>}
                    </span>
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
                          <select
                            name="category"
                            defaultValue={phaseOf(t.category)}
                            className={input}
                          >
                            {EMAIL_PHASES.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.label}
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
                          Pre-attach documents matching
                          <input
                            name="attachMatch"
                            defaultValue={t.attachMatch ?? ""}
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
