-- AlterTable
ALTER TABLE "client" ADD COLUMN     "compliance_checklist_id" TEXT,
ADD COLUMN     "compliance_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "compliance_checklist" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_checklist_tenant_id_idx" ON "compliance_checklist"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_item_tenant_id_idx" ON "compliance_item"("tenant_id");

-- CreateIndex
CREATE INDEX "compliance_item_checklist_id_idx" ON "compliance_item"("checklist_id");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_compliance_checklist_id_fkey" FOREIGN KEY ("compliance_checklist_id") REFERENCES "compliance_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist" ADD CONSTRAINT "compliance_checklist_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_item" ADD CONSTRAINT "compliance_item_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_item" ADD CONSTRAINT "compliance_item_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "compliance_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for the compliance tables (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['compliance_checklist','compliance_item'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "compliance_checklist" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "compliance_item" TO freehold_app;
