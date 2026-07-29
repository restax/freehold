-- Scheduled mail on the shared address is held by Resend, not by our cron.
--
-- The flush only runs inside the nightly cron (Vercel's Hobby plan allows two
-- cron jobs and only daily schedules, so there is no hourly drain to add), and
-- a row waiting on it could sit for the best part of a day past the time the
-- coordinator picked. Resend takes a scheduled_at on the send itself and
-- releases the message on the minute, so the schedule moves there.
--
-- Same shape as nylas_schedule_id: these rows exist so the coordinator can see
-- and cancel the send, and the flush deliberately skips them — draining one
-- would put the message in the recipient's inbox a second time.

ALTER TABLE "email_outbox"
  ADD COLUMN "resend_email_id" TEXT;
