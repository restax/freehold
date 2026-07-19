-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "anchor" "DateAnchor",
ADD COLUMN     "due_date_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offset_days" INTEGER,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "proposed_for" TEXT;

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "proposed_dates" JSONB;
