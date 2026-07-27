"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import {
  defaultLayout,
  FORM_KIND_LABEL,
  type FormKind,
  isFormKind,
  normalizeLayout,
  parseLayout,
  slugifyFormName,
} from "@/lib/form-schema";
import { confirmed, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

/**
 * Form design. Anyone on the team may draft and arrange a form; only an
 * admin may publish one or point it at the public website — the same line
 * the Website page draws, because that is the moment a form stops being an
 * internal draft and starts facing the internet.
 */

/** First free slug for a name, per tenant. */
async function uniqueSlug(
  tx: { form: { findFirst: (a: unknown) => Promise<{ id: string } | null> } },
  base: string,
  excludeId?: string,
): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const clash = await tx.form.findFirst({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === excludeId) return slug;
    slug = `${base}-${n}`;
  }
}

export async function createForm(formData: FormData) {
  const { tenantId } = await requireTenant();
  const kindRaw = str(formData, "kind");
  if (!isFormKind(kindRaw)) return;
  const kind: FormKind = kindRaw;
  const name = str(formData, "name") || FORM_KIND_LABEL[kind];

  const form = await withTenant(tenantId, async (tx) => {
    const slug = await uniqueSlug(tx as never, slugifyFormName(name));
    return tx.form.create({
      data: {
        tenantId,
        kind,
        name,
        slug,
        title: name,
        layout: defaultLayout(kind) as never,
        status: "draft",
      },
    });
  });
  revalidatePath("/dashboard/forms");
  redirect(`/dashboard/forms/${form.id}`);
}

/**
 * Give one client their own version of a form. It starts as a copy of the
 * shared one so the TC edits differences rather than rebuilding, and starts
 * as a draft so a half-adjusted variant never reaches the client — until
 * it's published they keep seeing the shared form.
 */
export async function createClientFormVariant(formData: FormData) {
  const { tenantId } = await requireTenant();
  const clientId = str(formData, "clientId");
  const sourceId = str(formData, "sourceFormId");
  if (!clientId || !sourceId) return;

  const created = await withTenant(tenantId, async (tx) => {
    const [source, client] = await Promise.all([
      tx.form.findUnique({ where: { id: sourceId } }),
      tx.client.findUnique({ where: { id: clientId }, select: { name: true } }),
    ]);
    if (!source || !client) return null;
    // One private variant per client per kind — the DB enforces it too.
    const existing = await tx.form.findFirst({
      where: { kind: source.kind, clientId },
      select: { id: true },
    });
    if (existing) return existing;

    const slug = await uniqueSlug(tx as never, slugifyFormName(`${source.name} ${client.name}`));
    return tx.form.create({
      data: {
        tenantId,
        kind: source.kind,
        clientId,
        name: `${source.name} — ${client.name}`,
        slug,
        title: source.title,
        description: source.description,
        layout: source.layout as never,
        status: "draft",
        // A private variant is for this client's portal, never the website.
        showPublic: false,
        showPortal: source.showPortal,
      },
    });
  });
  if (!created) return;
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/forms");
  redirect(`/dashboard/forms/${created.id}`);
}

/**
 * Save the arrangement from the designer. Takes the layout as JSON rather
 * than FormData because the designer holds it as a document, and re-runs it
 * through normalizeLayout server-side: the client is not trusted to have
 * kept the invariants (two cells a row, unique answer keys).
 */
export async function saveFormLayout(
  id: string,
  layoutJson: string,
): Promise<{ ok: true } | { error: string }> {
  const { tenantId } = await requireTenant();
  if (!id) return { error: "Missing form." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(layoutJson);
  } catch {
    return { error: "That layout could not be read." };
  }
  const layout = normalizeLayout(parseLayout(parsed));

  const saved = await withTenant(tenantId, async (tx) => {
    const existing = await tx.form.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    await tx.form.update({ where: { id }, data: { layout: layout as never } });
    return existing;
  });
  if (!saved) return { error: "That form no longer exists." };

  revalidatePath(`/dashboard/forms/${id}`);
  revalidatePath("/dashboard/forms");
  return { ok: true };
}

/** Name, wording, and slug — the parts that don't affect who can see it. */
export async function updateFormMeta(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return;

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.form.findUnique({ where: { id }, select: { slug: true } });
    if (!existing) return;
    const wanted = slugifyFormName(str(formData, "slug") || name);
    const slug =
      wanted === existing.slug ? existing.slug : await uniqueSlug(tx as never, wanted, id);
    await tx.form.update({
      where: { id },
      data: {
        name,
        slug,
        title: str(formData, "title") || name,
        description: optStr(formData, "description"),
      },
    });
  });
  revalidatePath(`/dashboard/forms/${id}`);
  revalidatePath("/dashboard/forms");
}

/**
 * Publishing and placement — admin only. A published form with showPublic
 * is reachable by anyone on the internet, so this is deliberately the same
 * gate the Website page uses.
 */
export async function updateFormPlacement(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin) return;
  const status = str(formData, "status") === "published" ? "published" : "draft";
  const showPublic = formData.get("showPublic") === "on";
  const showPortal = formData.get("showPortal") === "on";

  const form = await withTenant(tenantId, async (tx) => {
    const existing = await tx.form.findUnique({
      where: { id },
      select: { name: true, status: true, showPublic: true },
    });
    if (!existing) return null;
    await tx.form.update({ where: { id }, data: { status, showPublic, showPortal } });
    return existing;
  });
  if (!form) return;

  // Worth an audit entry: this is the switch that exposes a form publicly.
  if (form.status !== status || form.showPublic !== showPublic) {
    logAudit({
      tenantId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "form.placement_changed",
      summary: `Form "${form.name}" is now ${status}${showPublic ? ", on the public website" : ""}`,
      subjectType: "form",
      subjectId: id,
    });
  }
  revalidatePath(`/dashboard/forms/${id}`);
  revalidatePath("/dashboard/forms");
}

export async function deleteForm(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.form.delete({ where: { id }, select: { name: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "form.deleted",
    summary: `Deleted form "${gone.name}" (submissions kept)`,
    subjectType: "form",
    subjectId: id,
  });
  revalidatePath("/dashboard/forms");
  redirect("/dashboard/forms");
}
