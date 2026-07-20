-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "license_enforcement" TEXT NOT NULL DEFAULT 'warn';

-- CreateTable
CREATE TABLE "tenant_state" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "license_required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_state_tenant_id_idx" ON "tenant_state"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_state_tenant_id_state_key" ON "tenant_state"("tenant_id", "state");

-- AddForeignKey
ALTER TABLE "tenant_state" ADD CONSTRAINT "tenant_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security (same pattern as prior stages).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE tenant_state ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE tenant_state FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY tenant_state_tenant_isolation ON tenant_state USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_state" TO freehold_app;
