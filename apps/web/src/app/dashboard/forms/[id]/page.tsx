import { prisma, withTenant } from "@freehold/db";
import { ArrowSquareOut, Globe, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badges";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { FormDesigner } from "@/components/form-designer";
import { deleteForm, updateFormMeta, updateFormPlacement } from "@/lib/actions/forms";
import { FORM_KIND_LABEL, type FormKind, isFormKind, parseLayout } from "@/lib/form-schema";
import { tenantSiteUrl } from "@/lib/site-config";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, card, fieldGroupLabel, input, label as labelCls, summaryLink } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function FormDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;

  const [form, org] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.form.findUnique({
        where: { id },
        include: { client: { select: { id: true, name: true } } },
      }),
    ),
    prisma.organization.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true } }),
  ]);
  if (!form || !isFormKind(form.kind)) notFound();
  const kind: FormKind = form.kind;
  const layout = parseLayout(form.layout);
  const publicUrl =
    form.status === "published" && form.showPublic
      ? `${tenantSiteUrl(org.slug)}/f/${form.slug}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[{ label: "Forms", href: "/dashboard/forms" }, { label: form.name }]}
          />
          {isAdmin && (
            <DangerDelete
              compact
              action={deleteForm}
              label="Delete this form"
              description={`Removes "${form.name}". Submissions already received are kept — each carries its own copy of the form.`}
              hidden={{ id: form.id }}
            />
          )}
        </div>
        <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-semibold">
          {form.name}
          <Badge tone={form.status === "published" ? "success" : "neutral"}>
            {form.status === "published" ? "Published" : "Draft"}
          </Badge>
        </h1>
        <p className="text-sm text-stone-500">
          {FORM_KIND_LABEL[kind]}
          {form.client ? ` · private to ${form.client.name}` : ""}
          {form.showPublic || form.showPortal ? "" : " · not shown anywhere yet"}
        </p>
        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            <ArrowSquareOut size={14} aria-hidden />
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>

      <section className={card}>
        <FormDesigner formId={form.id} kind={kind} initialLayout={layout} />
      </section>

      <details className={card}>
        <summary className={summaryLink}>Wording &amp; address</summary>
        <form action={updateFormMeta} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="id" value={form.id} />
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={labelCls}>
              Internal name *
              <input name="name" required defaultValue={form.name} className={input} />
            </label>
            <label className={labelCls}>
              Heading people see
              <input name="title" defaultValue={form.title} className={input} />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              Intro text
              <input
                name="description"
                defaultValue={form.description ?? ""}
                className={input}
                placeholder="One line explaining what this is for."
              />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              Web address
              <input name="slug" defaultValue={form.slug} className={input} />
              <span className="text-xs font-normal text-stone-400">
                Public link ends /f/{form.slug}
              </span>
            </label>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <button type="submit" className={btn}>
              Save wording
            </button>
          </div>
        </form>
      </details>

      <section className={card}>
        <p className={fieldGroupLabel}>Where this form appears</p>
        <p className="mb-3 text-sm text-stone-500">
          A published form shows up on its own — no linking. Nothing is visible until you publish.
        </p>
        <form action={updateFormPlacement} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={form.id} />
          <label className={labelCls}>
            Status
            <select name="status" defaultValue={form.status} className={`${input} w-56`}>
              <option value="draft">Draft — visible only here</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="showPublic"
              defaultChecked={form.showPublic}
              className="mt-1 accent-brand-600"
            />
            <span className="flex flex-col">
              <span className="flex items-center gap-1.5 font-medium">
                <Globe size={14} className="text-stone-400" aria-hidden />
                Your public website
              </span>
              <span className="text-xs text-stone-400">
                Anyone on the internet can open and submit it. Submissions land in a review queue,
                never straight in your pipeline.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="showPortal"
              defaultChecked={form.showPortal}
              className="mt-1 accent-brand-600"
            />
            <span className="flex flex-col">
              <span className="flex items-center gap-1.5 font-medium">
                <UsersThree size={14} className="text-stone-400" aria-hidden />
                Client portals
              </span>
              <span className="text-xs text-stone-400">
                Signed-in clients see it with their own details already filled in.
              </span>
            </span>
          </label>
          <div className="border-t border-stone-100 pt-3">
            <button type="submit" className={btn}>
              Save placement
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
