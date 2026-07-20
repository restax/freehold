-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'DECLINED', 'ENDED');

-- CreateTable
CREATE TABLE "engagement" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_tenant_id" TEXT NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "guest_user_id" TEXT,
    "requested_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engagement_tenant_id_idx" ON "engagement"("tenant_id");

-- CreateIndex
CREATE INDEX "engagement_vendor_tenant_id_idx" ON "engagement"("vendor_tenant_id");

-- AddForeignKey
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_vendor_tenant_id_fkey" FOREIGN KEY ("vendor_tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement" ADD CONSTRAINT "engagement_guest_user_id_fkey" FOREIGN KEY ("guest_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security. Unlike every other tenant table, an engagement is a
-- relationship BETWEEN two workspaces: both the hirer and the vendor must be
-- able to read and update their own row, so the policy matches either side.
-- Inserting still requires being the hiring tenant — you cannot conjure an
-- engagement into someone else's workspace.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE engagement ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE engagement FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY engagement_party_isolation ON engagement
             USING (
               tenant_id = current_setting(''app.tenant_id'', true)
               OR vendor_tenant_id = current_setting(''app.tenant_id'', true)
             )
             WITH CHECK (
               tenant_id = current_setting(''app.tenant_id'', true)
               OR vendor_tenant_id = current_setting(''app.tenant_id'', true)
             )';
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "engagement" TO freehold_app;
