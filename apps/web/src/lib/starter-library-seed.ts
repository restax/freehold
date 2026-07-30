import { type AssigneeRole, type TenantTx, withTenant } from "@freehold/db";
import { STARTER_EMAIL_TEMPLATES } from "@/lib/starter-email-templates";
import {
  STARTER_ATTACHMENT_TEMPLATES,
  STARTER_DATE_TEMPLATES,
  STARTER_TASK_PLANS,
  type StarterTaskEntry,
} from "@/lib/starter-task-plans";

/**
 * Freehold's starter library: the task, email, attachment, and key-dates
 * templates every new workspace gets, and the "Restore starter templates"
 * action existing ones can re-run.
 *
 * Idempotent at the level a coordinator actually thinks about — by name. A
 * task plan, attachment checklist, or date template that already exists is
 * left alone entirely (an edited copy is never touched); an email template
 * follows the same by-name rule the existing default-email seeding already
 * uses. Re-running only fills in what's missing, so this is safe to call
 * from onboarding and from a "restore" button with the same code path.
 */

interface SeedCounts {
  emailTemplates: number;
  attachmentTemplates: number;
  dateTemplates: number;
  taskPlans: number;
}

export async function ensureGroup(
  tx: TenantTx,
  tenantId: string,
  kind: "TASK" | "EMAIL" | "ATTACHMENT" | "DATE",
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const cacheKey = `${kind}:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const existing = await tx.templateGroup.findFirst({
    where: { kind, name },
    select: { id: true },
  });
  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }
  const max = await tx.templateGroup.aggregate({ where: { kind }, _max: { sortOrder: true } });
  const created = await tx.templateGroup.create({
    data: { tenantId, kind, name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  cache.set(cacheKey, created.id);
  return created.id;
}

export async function seedStarterLibrary(tenantId: string): Promise<SeedCounts> {
  return withTenant(tenantId, async (tx) => {
    const groupCache = new Map<string, string>();

    // ---- Email templates: idempotent by name; id captured for every row
    // (new or pre-existing) so task-plan entries can reference either.
    const existingEmails = await tx.emailTemplate.findMany({ select: { id: true, name: true } });
    const emailIdByName = new Map(existingEmails.map((t) => [t.name, t.id]));
    const emailIdByKey = new Map<string, string>();
    let addedEmails = 0;
    for (const t of STARTER_EMAIL_TEMPLATES) {
      const already = emailIdByName.get(t.name);
      if (already) {
        emailIdByKey.set(t.key, already);
        continue;
      }
      const groupId = await ensureGroup(tx, tenantId, "EMAIL", t.group, groupCache);
      const created = await tx.emailTemplate.create({
        data: {
          tenantId,
          groupId,
          name: t.name,
          subject: t.subject,
          body: t.body,
          category: t.category,
          toDefault: t.toDefault ?? null,
          ccDefault: t.ccDefault ?? "{{agent_email}}",
          composeNote: t.composeNote ?? null,
          filePlaceholders: t.filePlaceholders ?? null,
          isSample: false,
        },
      });
      emailIdByKey.set(t.key, created.id);
      addedEmails++;
    }

    // ---- Attachment templates: skip entirely if the name already exists.
    let addedAttachments = 0;
    for (const at of STARTER_ATTACHMENT_TEMPLATES) {
      const already = await tx.attachmentTemplate.findFirst({
        where: { name: at.name },
        select: { id: true },
      });
      if (already) continue;
      const groupId = await ensureGroup(tx, tenantId, "ATTACHMENT", at.group, groupCache);
      await tx.attachmentTemplate.create({
        data: {
          tenantId,
          groupId,
          name: at.name,
          description: at.description,
          isSample: false,
          items: {
            create: at.items.map((label, i) => ({ tenantId, label, sortOrder: i + 1 })),
          },
        },
      });
      addedAttachments++;
    }

    // ---- Date templates: same skip-if-exists rule.
    let addedDateTemplates = 0;
    for (const dt of STARTER_DATE_TEMPLATES) {
      const already = await tx.dateTemplate.findFirst({
        where: { name: dt.name },
        select: { id: true },
      });
      if (already) continue;
      const groupId = await ensureGroup(tx, tenantId, "DATE", dt.group, groupCache);
      await tx.dateTemplate.create({
        data: {
          tenantId,
          groupId,
          name: dt.name,
          description: dt.description,
          isSample: false,
          items: {
            create: dt.items.map((item, i) => ({
              tenantId,
              dateKey: item.dateKey,
              label: item.label,
              anchor: item.anchor ?? null,
              offsetDays: item.offsetDays ?? null,
              calculator: item.calculator ?? null,
              sortOrder: i + 1,
            })),
          },
        },
      });
      addedDateTemplates++;
    }

    // ---- Task plans: skip entirely if the plan name already exists —
    // never partially merge into a workspace's edited copy.
    let addedPlans = 0;
    for (const plan of STARTER_TASK_PLANS) {
      const already = await tx.actionPlan.findFirst({
        where: { name: plan.name },
        select: { id: true },
      });
      if (already) continue;
      const groupId = await ensureGroup(tx, tenantId, "TASK", plan.group, groupCache);
      const createdPlan = await tx.actionPlan.create({
        data: {
          tenantId,
          groupId,
          name: plan.name,
          description: plan.description,
          isSample: false,
        },
      });

      // Created one at a time (not createMany) so each entry's real id can
      // be captured immediately — the dependency pass below needs it, and
      // createMany doesn't return rows.
      const taskIdByKey = new Map<string, string>();
      for (const [i, entry] of plan.entries.entries()) {
        const created = await tx.actionPlanTask.create({
          data: {
            tenantId,
            actionPlanId: createdPlan.id,
            title: entry.title,
            kind: entry.kind,
            anchor: entry.anchor,
            offsetDays: entry.offsetDays,
            sides: entry.sides ?? [],
            assigneeRole: "TC1" as AssigneeRole,
            milestone: entry.milestone ?? false,
            visibleToAgent: true,
            visibleToClient: entry.visibleToClient ?? true,
            emailTemplateId: entry.emailKey ? (emailIdByKey.get(entry.emailKey) ?? null) : null,
            autoSendEmail: false,
            sortOrder: i + 1,
          },
        });
        taskIdByKey.set(entry.key, created.id);
      }
      await wireDependencies(tx, plan.entries, taskIdByKey);
      addedPlans++;
    }

    return {
      emailTemplates: addedEmails,
      attachmentTemplates: addedAttachments,
      dateTemplates: addedDateTemplates,
      taskPlans: addedPlans,
    };
  });
}

async function wireDependencies(
  tx: TenantTx,
  entries: StarterTaskEntry[],
  taskIdByKey: Map<string, string>,
): Promise<void> {
  for (const entry of entries) {
    if (!entry.dependsOnKey) continue;
    const selfId = taskIdByKey.get(entry.key);
    const targetId = taskIdByKey.get(entry.dependsOnKey);
    if (selfId && targetId) {
      await tx.actionPlanTask.update({ where: { id: selfId }, data: { dependsOnId: targetId } });
    }
  }
}
