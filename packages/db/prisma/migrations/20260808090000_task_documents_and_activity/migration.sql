-- Task detail screen: a task can now be worked from its own page, which means
-- files produced or collected for it, and a work log of what was done.
--
-- Both links are advisory and SetNull on delete. A document belongs to the
-- transaction, not the checklist item that prompted it, and the record that a
-- call happened outlives the task it was made for. Neither table gains a new
-- tenant boundary: both are already tenant-owned with RLS, and the task they
-- point at is reached through the same tenant.

ALTER TABLE "document" ADD COLUMN "task_id" TEXT;
ALTER TABLE "document"
  ADD CONSTRAINT "document_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transaction_activity" ADD COLUMN "task_id" TEXT;
ALTER TABLE "transaction_activity"
  ADD CONSTRAINT "transaction_activity_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "task"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The task screen's own feed reads by task, newest first. Note the quoted
-- camelCase: transaction_activity.createdAt is not @map-ped, unlike the
-- snake_case columns beside it.
CREATE INDEX "transaction_activity_task_id_createdAt_idx"
  ON "transaction_activity"("task_id", "createdAt");
