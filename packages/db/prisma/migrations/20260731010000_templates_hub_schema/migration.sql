-- Templates hub: schema for the unified Tasks / Emails / Attachments /
-- Key dates / Doc templates surface.
--
-- New enums: task kind, formal assignee roles/seats, template group kind.
-- DateAnchor widens from the two governed dates (contract/close) to every
-- transaction date plus two new kinds of anchor: TEMPLATE_START (the day a
-- plan was applied) and DEPENDENCY (dated off another task's completion).

CREATE TYPE "TaskKind" AS ENUM ('TODO', 'EMAIL', 'CALL');
CREATE TYPE "AssigneeRole" AS ENUM ('TC1', 'TC2', 'AGENT');
CREATE TYPE "AssigneeSlot" AS ENUM ('TC1', 'TC2');
CREATE TYPE "TemplateGroupKind" AS ENUM ('TASK', 'EMAIL', 'ATTACHMENT', 'DATE', 'DOC');

ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'LIST_DATE';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'EXPIRE_DATE';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'MORTGAGE_COMMITMENT_DATE';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'INSPECTION_DEADLINE_DATE';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'EARNEST_MONEY_DUE_DATE';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'TEMPLATE_START';
ALTER TYPE "DateAnchor" ADD VALUE IF NOT EXISTS 'DEPENDENCY';

-- Transaction: earnest-money due date, a real column for the same reason
-- close/mortgage-commitment/inspection-deadline are — a date-template anchor
-- and calendar entry that can't depend on a task title matching a phrase.
ALTER TABLE "transaction" ADD COLUMN "earnest_money_due_date" DATE;

-- Organization: which US federal holidays count as non-business days for
-- date-template calculators. Null = the full default set.
ALTER TABLE "organization" ADD COLUMN "holiday_schedule" JSONB;

-- TransactionAssignee: the formal seat (if any) this person fills on the
-- file. At most one person per seat per file — Postgres treats multiple
-- NULLs as distinct, so this only constrains rows that actually claim a slot.
ALTER TABLE "transaction_assignee" ADD COLUMN "slot" "AssigneeSlot";
CREATE UNIQUE INDEX "transaction_assignee_transaction_id_slot_key"
  ON "transaction_assignee"("transaction_id", "slot");

-- ============================================================================
-- TemplateGroup — groups within one hub tab, scoped by kind.
-- ============================================================================
CREATE TABLE "template_group" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" "TemplateGroupKind" NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_group_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "template_group_tenant_id_kind_idx" ON "template_group"("tenant_id", "kind");
ALTER TABLE "template_group" ADD CONSTRAINT "template_group_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_group" FORCE ROW LEVEL SECURITY;
CREATE POLICY template_group_tenant_isolation ON "template_group"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "template_group" TO freehold_app;

-- ============================================================================
-- AttachmentTemplate / AttachmentTemplateItem — standalone document checklists.
-- ============================================================================
CREATE TABLE "attachment_template" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "group_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachment_template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachment_template_tenant_id_idx" ON "attachment_template"("tenant_id");
CREATE INDEX "attachment_template_tenant_id_group_id_idx" ON "attachment_template"("tenant_id", "group_id");
ALTER TABLE "attachment_template" ADD CONSTRAINT "attachment_template_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_template" ADD CONSTRAINT "attachment_template_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "template_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attachment_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachment_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY attachment_template_tenant_isolation ON "attachment_template"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attachment_template" TO freehold_app;

CREATE TABLE "attachment_template_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attachment_template_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attachment_template_item_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachment_template_item_tenant_id_idx" ON "attachment_template_item"("tenant_id");
ALTER TABLE "attachment_template_item" ADD CONSTRAINT "attachment_template_item_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_template_item" ADD CONSTRAINT "attachment_template_item_attachment_template_id_fkey"
  FOREIGN KEY ("attachment_template_id") REFERENCES "attachment_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_template_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachment_template_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY attachment_template_item_tenant_isolation ON "attachment_template_item"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attachment_template_item" TO freehold_app;

-- ============================================================================
-- DateTemplate / DateTemplateItem — named sets of key dates with suggested
-- calculators.
-- ============================================================================
CREATE TABLE "date_template" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "group_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "date_template_tenant_id_idx" ON "date_template"("tenant_id");
CREATE INDEX "date_template_tenant_id_group_id_idx" ON "date_template"("tenant_id", "group_id");
ALTER TABLE "date_template" ADD CONSTRAINT "date_template_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "date_template" ADD CONSTRAINT "date_template_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "template_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "date_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "date_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY date_template_tenant_isolation ON "date_template"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "date_template" TO freehold_app;

CREATE TABLE "date_template_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "date_template_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "anchor" "DateAnchor",
    "offset_days" INTEGER,
    "calculator" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "date_template_item_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "date_template_item_tenant_id_idx" ON "date_template_item"("tenant_id");
ALTER TABLE "date_template_item" ADD CONSTRAINT "date_template_item_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "date_template_item" ADD CONSTRAINT "date_template_item_date_template_id_fkey"
  FOREIGN KEY ("date_template_id") REFERENCES "date_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "date_template_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "date_template_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY date_template_item_tenant_isolation ON "date_template_item"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "date_template_item" TO freehold_app;

-- ============================================================================
-- ActionPlan / ActionPlanTask: group, kind, sides, dependency dating, the
-- toggle cluster (milestone/calendar/portal visibility), and links to the
-- other template types.
-- ============================================================================
ALTER TABLE "action_plan" ADD COLUMN "group_id" TEXT;
CREATE INDEX "action_plan_tenant_id_group_id_idx" ON "action_plan"("tenant_id", "group_id");
ALTER TABLE "action_plan" ADD CONSTRAINT "action_plan_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "template_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "action_plan_task" ADD COLUMN "notes" TEXT;
ALTER TABLE "action_plan_task" ADD COLUMN "kind" "TaskKind" NOT NULL DEFAULT 'TODO';
ALTER TABLE "action_plan_task" ADD COLUMN "depends_on_id" TEXT;
ALTER TABLE "action_plan_task" ADD COLUMN "sides" "TransactionSide"[] NOT NULL DEFAULT '{}';
ALTER TABLE "action_plan_task" ADD COLUMN "milestone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "action_plan_task" ADD COLUMN "on_calendar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "action_plan_task" ADD COLUMN "visible_to_agent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "action_plan_task" ADD COLUMN "visible_to_client" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "action_plan_task" ADD COLUMN "attachment_template_id" TEXT;
ALTER TABLE "action_plan_task" ADD COLUMN "date_template_id" TEXT;
ALTER TABLE "action_plan_task" ADD COLUMN "doc_template_id" TEXT;

-- assignee_role moves from free text to the formal AssigneeRole enum. No
-- production workspace has real data yet (sample/demo only), and the column
-- was already dead downstream (see applyActionPlan) — drop and re-add rather
-- than attempt a lossy text->enum cast.
ALTER TABLE "action_plan_task" DROP COLUMN "assignee_role";
ALTER TABLE "action_plan_task" ADD COLUMN "assignee_role" "AssigneeRole";

CREATE INDEX "action_plan_task_tenant_id_actionPlanId_idx" ON "action_plan_task"("tenant_id", "actionPlanId");
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_depends_on_id_fkey"
  FOREIGN KEY ("depends_on_id") REFERENCES "action_plan_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_attachment_template_id_fkey"
  FOREIGN KEY ("attachment_template_id") REFERENCES "attachment_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_date_template_id_fkey"
  FOREIGN KEY ("date_template_id") REFERENCES "date_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_plan_task" ADD CONSTRAINT "action_plan_task_doc_template_id_fkey"
  FOREIGN KEY ("doc_template_id") REFERENCES "doc_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Task (live): kind, milestone, calendar, formal assignee role, and
-- task-to-task dependency dating.
-- ============================================================================
ALTER TABLE "task" ADD COLUMN "kind" "TaskKind" NOT NULL DEFAULT 'TODO';
ALTER TABLE "task" ADD COLUMN "milestone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "task" ADD COLUMN "on_calendar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "task" ADD COLUMN "assignee_role" "AssigneeRole";
ALTER TABLE "task" ADD COLUMN "depends_on_task_id" TEXT;
ALTER TABLE "task" ADD CONSTRAINT "task_depends_on_task_id_fkey"
  FOREIGN KEY ("depends_on_task_id") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- EmailTemplate / DocTemplate: group + email compose defaults.
-- ============================================================================
ALTER TABLE "email_template" ADD COLUMN "group_id" TEXT;
ALTER TABLE "email_template" ADD COLUMN "to_default" TEXT;
ALTER TABLE "email_template" ADD COLUMN "cc_default" TEXT;
ALTER TABLE "email_template" ADD COLUMN "compose_note" TEXT;
CREATE INDEX "email_template_tenant_id_group_id_idx" ON "email_template"("tenant_id", "group_id");
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "template_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "doc_template" ADD COLUMN "group_id" TEXT;
CREATE INDEX "doc_template_tenant_id_group_id_idx" ON "doc_template"("tenant_id", "group_id");
ALTER TABLE "doc_template" ADD CONSTRAINT "doc_template_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "template_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
