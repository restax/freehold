-- Client profiles: teams as a first-class client type, office address,
-- billing contact (invoice emails route here when set), and the brokerage
-- an individual agent hangs their license with.
ALTER TYPE "ClientType" ADD VALUE IF NOT EXISTS 'TEAM' AFTER 'BROKERAGE';

ALTER TABLE "client" ADD COLUMN "address" TEXT;
ALTER TABLE "client" ADD COLUMN "billing_contact" JSONB;
ALTER TABLE "client" ADD COLUMN "brokerage_info" JSONB;
