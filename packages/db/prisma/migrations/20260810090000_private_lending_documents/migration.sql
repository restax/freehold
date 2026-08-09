-- The lending file: no buy or sell side, and invoices whose payment matters.
--
-- BORROWER is a side on both enums. A private lender's file is a loan, so
-- there is no buy or sell to be on: the workspace represents the lender and
-- the party at the other end is the borrower. On ComplianceSide it is
-- deliberately outside BOTH, which is a workspace's catch-all for *sale*
-- checklists — sweeping one of those onto an underwriting package would ask a
-- loan file for a listing agreement.
--
-- Payment tracking exists for exactly two lines of the standard lending
-- package: the insurance invoice and the appraisal invoice. What a processor
-- needs to know is not really "was this paid" but "is this coming out of the
-- closing", because anything still due has to land on the settlement
-- statement. Hence DUE_AT_CLOSING as a state of its own rather than a flavour
-- of unpaid, and a nullable column so "nobody has answered yet" stays
-- distinguishable from "confirmed not yet paid".

ALTER TYPE "TransactionSide" ADD VALUE 'BORROWER';
ALTER TYPE "ComplianceSide" ADD VALUE 'BORROWER';

CREATE TYPE "CompliancePaymentStatus" AS ENUM (
  'UNPAID',
  'PAID_IN_FULL',
  'PAID_COD',
  'DUE_AT_CLOSING'
);

ALTER TABLE "compliance_item"
  ADD COLUMN "payment_tracked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "compliance_slot"
  ADD COLUMN "payment_tracked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "compliance_slot"
  ADD COLUMN "payment_status" "CompliancePaymentStatus";
