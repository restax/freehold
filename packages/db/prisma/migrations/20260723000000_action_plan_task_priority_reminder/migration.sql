-- AlterTable
ALTER TABLE "action_plan_task" ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "reminder_days" INTEGER;
