-- Billing authority per member: large TC organizations have staff who run
-- the money without being workspace admins. null follows the role; "view",
-- "manage", and "full" grant increasing billing access (full includes team
-- payout/comp visibility). member is an auth-plugin table (no tenant RLS).

-- AlterTable
ALTER TABLE "member" ADD COLUMN "billing_role" TEXT;
