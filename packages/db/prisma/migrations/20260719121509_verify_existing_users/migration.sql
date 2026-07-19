-- Email verification (6-digit OTP) shipped 2026-07-19. Accounts that existed
-- before enforcement are grandfathered as verified so nobody is locked out;
-- everyone signing up after this migration verifies normally.
UPDATE "user" SET "emailVerified" = true;
