-- Sending as the coordinator rather than as the workspace.
--
-- email: mail sent from someone's own mailbox has no reply+<token> address —
-- the recipient replies to a real person, which is the point — so the thread
-- id Nylas assigns is what an inbound reply will carry, and therefore what
-- puts that reply back on this file. Indexed for exactly that lookup.
--
-- email_outbox: a scheduled send can now be held by Nylas instead of by our
-- cron. Those rows are records for the UI (see it, cancel it), not work for
-- the flush — the flush skips anything with a schedule id, or the message
-- goes out twice. The grant is stored next to the id because cancelling
-- addresses the grant that made the schedule, and reconnecting a mailbox
-- replaces a user's grant.

ALTER TABLE "email"
  ADD COLUMN "nylas_thread_id" TEXT,
  ADD COLUMN "nylas_sent_by"   TEXT;

CREATE INDEX "email_nylas_thread_id_idx" ON "email"("nylas_thread_id");

ALTER TABLE "email_outbox"
  ADD COLUMN "send_as_user_id"   TEXT,
  ADD COLUMN "nylas_schedule_id" TEXT,
  ADD COLUMN "nylas_grant_id"    TEXT;
