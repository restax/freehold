-- Named attachment slots an email template expects, shown as chips on the
-- compose screen alongside the existing keyword-matched pre-check.
ALTER TABLE "email_template" ADD COLUMN "file_placeholders" TEXT;
