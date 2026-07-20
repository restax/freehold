-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ComplianceSlotStatus" AS ENUM ('MISSING', 'ATTACHED', 'SUBMITTED', 'APPROVED', 'RETURNED');

-- CreateTable
CREATE TABLE "transaction_compliance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "checklist_id" TEXT,
    "checklist_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_slot" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "compliance_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "document_id" TEXT,
    "status" "ComplianceSlotStatus" NOT NULL DEFAULT 'MISSING',
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_compliance_tenant_id_idx" ON "transaction_compliance"("tenant_id");

-- CreateIndex
CREATE INDEX "transaction_compliance_transaction_id_idx" ON "transaction_compliance"("transaction_id");

-- CreateIndex
CREATE INDEX "compliance_slot_tenant_id_idx" ON "compliance_slot"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_slot_compliance_id_idx" ON "compliance_slot"("compliance_id");

-- AddForeignKey
ALTER TABLE "transaction_compliance" ADD CONSTRAINT "transaction_compliance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_compliance" ADD CONSTRAINT "transaction_compliance_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_compliance" ADD CONSTRAINT "transaction_compliance_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "compliance_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_slot" ADD CONSTRAINT "compliance_slot_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_slot" ADD CONSTRAINT "compliance_slot_compliance_id_fkey" FOREIGN KEY ("compliance_id") REFERENCES "transaction_compliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_slot" ADD CONSTRAINT "compliance_slot_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security for the compliance workflow tables (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transaction_compliance','compliance_slot'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_compliance" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "compliance_slot" TO freehold_app;
