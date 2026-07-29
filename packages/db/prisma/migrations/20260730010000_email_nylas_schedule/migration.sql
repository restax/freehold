-- A Nylas-scheduled send previously had no Email row at all until it went
-- out, unlike the Resend path, which writes one immediately with status
-- SCHEDULED. That meant a scheduled send-as-self was invisible on the
-- transaction's Emails tab until send time, and permanently invisible if
-- cancelled before it went out.
--
-- The Nylas path now writes the Email row at schedule time too, keyed by
-- this column instead of provider_id/nylas_thread_id — the real message
-- doesn't exist yet, only the schedule Nylas is holding. Cancel and the
-- send-completion webhook both match on it to update the same row rather
-- than leaving a stale SCHEDULED entry behind.

ALTER TABLE "email"
  ADD COLUMN "nylas_schedule_id" TEXT;

CREATE INDEX "email_nylas_schedule_id_idx" ON "email"("nylas_schedule_id");
