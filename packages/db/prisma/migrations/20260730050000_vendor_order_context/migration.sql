-- Vendor orders carry enough context for a cold vendor to act without
-- guessing: who the order is for, who to call, and who to bill.

ALTER TABLE "vendor_order"
  ADD COLUMN "on_behalf_of" TEXT,
  ADD COLUMN "requested_by_name" TEXT,
  ADD COLUMN "requested_by_email" TEXT,
  ADD COLUMN "requester_phone" TEXT,
  ADD COLUMN "billing_contact" JSONB;
