-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "side_labels" JSONB;

-- AlterTable
ALTER TABLE "portal_link" ADD COLUMN     "show_intake" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "intake_submission" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "portal_link_id" TEXT,
    "side" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intake_submission_tenant_id_transaction_id_idx" ON "intake_submission"("tenant_id", "transaction_id");

-- AddForeignKey
ALTER TABLE "intake_submission" ADD CONSTRAINT "intake_submission_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_submission" ADD CONSTRAINT "intake_submission_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "intake_submission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_submission_tenant_isolation ON "intake_submission"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "intake_submission" TO freehold_app;
