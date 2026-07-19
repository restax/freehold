-- AlterTable
ALTER TABLE "action_plan_task" ADD COLUMN     "email_template_id" TEXT;

-- AlterTable
ALTER TABLE "email_template" ADD COLUMN     "attach_match" TEXT,
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "email_template_id" TEXT;
