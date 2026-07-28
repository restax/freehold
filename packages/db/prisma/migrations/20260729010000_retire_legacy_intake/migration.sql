-- Retiring the hardcoded buy/sell portal intake now that designed forms
-- (Form/FormSubmission, placed in portals via portalFormsFor) fully cover
-- the same job. portal_link.show_intake gated the old entry point only —
-- there is no longer any code path that reads it.
--
-- intake_submission is untouched: it is the historical record of what
-- clients already submitted through the old form, still shown on the
-- transaction page. Retiring the entry point does not touch data already
-- collected through it.
ALTER TABLE "portal_link" DROP COLUMN "show_intake";
