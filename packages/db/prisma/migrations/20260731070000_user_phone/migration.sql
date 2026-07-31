-- The coordinator's own phone number. Until now the signature card on every
-- outbound email could show the agent's phone and the other side's, but never
-- the TC's — there was nowhere to put one. Also fills the {{tc_phone}} merge
-- code, which already existed in templates but always rendered empty.
ALTER TABLE "user" ADD COLUMN "phone" TEXT;
