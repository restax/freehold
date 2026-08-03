-- Terms-of-service acceptance record, stamped server-side by auth.ts's
-- user.create hook so it can't be spoofed from the client. Existing users
-- created before this migration are left null; they signed up under the
-- site's earlier "creating an account means you agree" disclosure rather
-- than the explicit checkbox this pairs with going forward.

ALTER TABLE "user" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "terms_version" TEXT;
