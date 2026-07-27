-- Percentage payouts for outsourced files: a teammate can be paid a share of
-- the file's fee revenue instead of a flat amount. Stored in basis points
-- (7000 = 70%) so payout arithmetic stays integer. "Earned" is the share of
-- what's billed; "payable" the share of what's collected; pay requests freeze
-- the collected figure at request time.

-- AlterTable
ALTER TABLE "transaction_assignee" ADD COLUMN "fee_percent_bp" INTEGER;
