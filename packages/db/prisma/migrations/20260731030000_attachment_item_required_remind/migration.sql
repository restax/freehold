-- Mandatory-vs-optional flag and an opt-in auto-reminder cadence for
-- attachment-checklist template items, carried forward to the transaction's
-- checklist slot when the template is applied.
ALTER TABLE "attachment_template_item" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "attachment_template_item" ADD COLUMN "remind_enabled" BOOLEAN NOT NULL DEFAULT false;
