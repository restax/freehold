-- CreateTable
CREATE TABLE "action_plan_document" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action_plan_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "action_plan_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_required_document" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "document_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_required_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_plan_document_tenant_id_idx" ON "action_plan_document"("tenant_id");

-- CreateIndex
CREATE INDEX "transaction_required_document_tenant_id_idx" ON "transaction_required_document"("tenant_id");

-- CreateIndex
CREATE INDEX "transaction_required_document_transaction_id_idx" ON "transaction_required_document"("transaction_id");

-- AddForeignKey
ALTER TABLE "action_plan_document" ADD CONSTRAINT "action_plan_document_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_plan_document" ADD CONSTRAINT "action_plan_document_action_plan_id_fkey" FOREIGN KEY ("action_plan_id") REFERENCES "action_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_required_document" ADD CONSTRAINT "transaction_required_document_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_required_document" ADD CONSTRAINT "transaction_required_document_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_required_document" ADD CONSTRAINT "transaction_required_document_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-level security (same pattern as prior tenant tables).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE action_plan_document ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE action_plan_document FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY action_plan_document_tenant_isolation ON action_plan_document USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
  EXECUTE 'ALTER TABLE transaction_required_document ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE transaction_required_document FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY transaction_required_document_tenant_isolation ON transaction_required_document USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "action_plan_document" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_required_document" TO freehold_app;
