import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { DangerDelete } from "@/components/danger-delete";
import { SectionCard } from "@/components/section-card";
import { SignaturePermissionToggle } from "@/components/signature-permission-toggle";
import { TemplateEditor } from "@/components/template-editor";
import {
  createSignature,
  deleteSignature,
  saveSignaturePermission,
  setDefaultSignature,
  updateSignature,
} from "@/lib/actions/signatures";
import { saveEmailSettings, saveEmailTemplates, saveReviewDelay } from "@/lib/actions/templates";
import { EMAIL_MERGE_CODES, parseEmailSettings, parseEmailTemplates } from "@/lib/email-template";
import { parseQuietHours } from "@/lib/outbox";
import { requireAdminTenant } from "@/lib/tenant";
import { parseAppearance, resolveEmailAccent } from "@/lib/theme";
import { btn, btnGhost, input, label as labelCls, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";

const HOURS: Array<[number, string]> = Array.from({ length: 24 }, (_, h) => [
  h,
  `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`,
]);

export default async function EmailTemplatesPage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      name: true,
      emailTemplates: true,
      emailSettings: true,
      appearanceConfig: true,
      membersCanEditSignatures: true,
    },
  });
  const automated = parseEmailTemplates(org.emailTemplates);
  const settings = parseEmailSettings(org.emailSettings);
  const quiet = parseQuietHours(org.emailSettings);
  const accent = resolveEmailAccent(parseAppearance(org.appearanceConfig));
  const signatures = await withTenant(tenantId, (tx) =>
    tx.emailSignature.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  );
  const canEditSignatures = isAdmin || org.membersCanEditSignatures;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Email templates</h1>
        <p className="text-sm text-stone-500">
          Every email your workspace sends starts here: reusable templates (one click away from any
          task), the automated lifecycle emails, and your signature and footer. Looking for PDF
          letters?{" "}
          <Link href="/dashboard/templates?tab=docs" className="text-brand-700 hover:underline">
            Doc templates →
          </Link>
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Merge fields fill from the transaction when sent: {EMAIL_MERGE_CODES.join(" ")}
        </p>
      </div>

      <SectionCard title="Signature &amp; footer">
        <p className="mb-4 text-sm text-stone-500">
          Appended to every outgoing email — change it once here and it changes everywhere,
          including the automated emails.
        </p>
        <form action={saveEmailSettings} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-700">Signature</span>
            <TemplateEditor
              name="signature"
              defaultValue={settings.signature}
              rows={4}
              tenantName={org.name}
              accent={accent}
            />
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
      </SectionCard>

      <SectionCard
        title="Signature blocks"
        action={
          isAdmin ? (
            <SignaturePermissionToggle
              action={saveSignaturePermission}
              defaultChecked={org.membersCanEditSignatures}
            />
          ) : null
        }
      >
        <p className="mb-4 text-sm text-stone-500">
          The "Your transaction coordinator" contact card at the bottom of every branded email —
          name, title, phone, email. Different from the signature above: that's an extra paragraph
          of text; this is the structured card, and a workspace can keep more than one (a shared
          support line vs. an individual coordinator's own number) and pick per email.
          {!canEditSignatures && " Only workspace admins can edit these."}
        </p>
        {signatures.length > 0 && (
          <ul className="mb-4 flex flex-col divide-y divide-stone-100">
            {signatures.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-800">{s.name}</span>
                  {s.isDefault ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                      Default
                    </span>
                  ) : (
                    canEditSignatures && (
                      <form action={setDefaultSignature}>
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-stone-500 hover:text-brand-700"
                        >
                          Make default
                        </button>
                      </form>
                    )
                  )}
                  {canEditSignatures && (
                    <span className="ml-auto">
                      <DangerDelete
                        compact
                        action={deleteSignature}
                        label={`Delete ${s.name}`}
                        description={`Removes the "${s.name}" signature block. Anyone using it for compose will fall back to the default.`}
                        hidden={{ id: s.id }}
                      />
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-600">
                  {s.displayName}
                  {s.title ? ` — ${s.title}` : ""}
                  {s.company ? ` · ${s.company}` : ""}
                </p>
                <p className="text-xs text-stone-400">
                  {[s.email, s.phone].filter(Boolean).join(" · ") || "No contact info on file"}
                </p>
                {canEditSignatures && (
                  <details className="mt-1">
                    <summary className={summaryLink}>Edit</summary>
                    <form
                      action={updateSignature}
                      className="mt-2 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <label className={labelCls}>
                        Label (picker only)
                        <input name="name" defaultValue={s.name} required className={input} />
                      </label>
                      <label className={labelCls}>
                        Name shown on the card
                        <input
                          name="displayName"
                          defaultValue={s.displayName}
                          required
                          className={input}
                        />
                      </label>
                      <label className={labelCls}>
                        Title
                        <input name="title" defaultValue={s.title ?? ""} className={input} />
                      </label>
                      <label className={labelCls}>
                        Company
                        <input name="company" defaultValue={s.company ?? ""} className={input} />
                      </label>
                      <label className={labelCls}>
                        Email
                        <input
                          name="email"
                          type="email"
                          defaultValue={s.email ?? ""}
                          className={input}
                        />
                      </label>
                      <label className={labelCls}>
                        Phone
                        <input name="phone" defaultValue={s.phone ?? ""} className={input} />
                      </label>
                      <button type="submit" className={`${btn} self-start sm:col-span-2`}>
                        Save
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEditSignatures && (
          <details>
            <summary className={summaryLink}>+ Add a signature block</summary>
            <form
              action={createSignature}
              className="mt-2 grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2"
            >
              <label className={labelCls}>
                Label (picker only)
                <input name="name" placeholder="Jordan's cell" required className={input} />
              </label>
              <label className={labelCls}>
                Name shown on the card
                <input name="displayName" placeholder="Jordan Rivera" required className={input} />
              </label>
              <label className={labelCls}>
                Title
                <input name="title" placeholder="Transaction Coordinator" className={input} />
              </label>
              <label className={labelCls}>
                Company
                <input name="company" placeholder={org.name} className={input} />
              </label>
              <label className={labelCls}>
                Email
                <input name="email" type="email" className={input} />
              </label>
              <label className={labelCls}>
                Phone
                <input name="phone" placeholder="(312) 555-0148" className={input} />
              </label>
              <button type="submit" className={`${btn} self-start sm:col-span-2`}>
                Add signature block
              </button>
            </form>
          </details>
        )}
      </SectionCard>

      <SectionCard title="Template library">
        <p className="text-sm text-stone-500">
          Reusable email templates now live in the Templates hub, grouped and one click from any
          task.{" "}
          <Link href="/dashboard/templates?tab=emails" className="text-brand-700 hover:underline">
            Manage email templates →
          </Link>
        </p>
      </SectionCard>

      <SectionCard title="Automated emails">
        <p className="mb-4 text-sm text-stone-500">
          Sent for you: the intro when a file opens, the congratulations after closing, and the
          review ask a few days after that. Per-client on/off switches live on each client's page.
        </p>
        <form action={saveEmailTemplates} className="flex flex-col gap-4">
          <div className="grid gap-6 lg:grid-cols-3">
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
              <TemplateEditor
                name="introBody"
                defaultValue={automated.intro.body}
                rows={8}
                tenantName={org.name}
                accent={accent}
              />
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
                tenantName={org.name}
                accent={accent}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-stone-700">Review request</h3>
              <label className={labelCls}>
                Subject
                <input
                  name="reviewSubject"
                  defaultValue={automated.review.subject}
                  className={input}
                />
              </label>
              <span className="text-sm font-medium text-stone-700">Body</span>
              <TemplateEditor
                name="reviewBody"
                defaultValue={automated.review.body}
                rows={8}
                tenantName={org.name}
                accent={accent}
              />
            </div>
          </div>
          <button type="submit" className={`${btn} self-start`}>
            Save automated emails
          </button>
        </form>
        <form
          action={saveReviewDelay}
          className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4"
        >
          <label className={labelCls}>
            Send the review request
            <span className="flex items-center gap-2">
              <input
                type="number"
                name="reviewDelayDays"
                min={1}
                max={60}
                defaultValue={settings.reviewDelayDays}
                className={`${input} w-20`}
              />
              days after closing
            </span>
          </label>
          <button type="submit" className={`${btnGhost} self-end px-3 py-1.5 text-xs`}>
            Save
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
