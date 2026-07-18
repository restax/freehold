-- AlterTable
ALTER TABLE "task" ADD COLUMN     "completed_at" TIMESTAMP(3);

-- Existing DONE tasks: best-guess completion time from the last update.
UPDATE "task" SET "completed_at" = "updatedAt" WHERE "status" = 'DONE';
