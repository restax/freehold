-- AlterTable
ALTER TABLE "compliance_checklist" ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "compliance_slot" ADD COLUMN     "approved_tier" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "member" ADD COLUMN     "compliance_tier" INTEGER;

-- AlterTable
ALTER TABLE "transaction_compliance" ADD COLUMN     "approval_levels" INTEGER NOT NULL DEFAULT 1;
