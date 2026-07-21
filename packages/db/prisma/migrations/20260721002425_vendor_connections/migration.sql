-- CreateEnum
CREATE TYPE "VendorConnectionStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConnectionInitiator" AS ENUM ('TENANT', 'VENDOR');

-- CreateTable
CREATE TABLE "vendor_connection" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "VendorConnectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by" "ConnectionInitiator" NOT NULL,
    "note" TEXT,
    "requested_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_connection_tenant_id_idx" ON "vendor_connection"("tenant_id");

-- CreateIndex
CREATE INDEX "vendor_connection_vendor_id_idx" ON "vendor_connection"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_connection_tenant_id_vendor_id_key" ON "vendor_connection"("tenant_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "vendor_connection" ADD CONSTRAINT "vendor_connection_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_connection" ADD CONSTRAINT "vendor_connection_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security. A vendor connection joins a coordinator's workspace to a
-- vendor. The coordinator side keys off app.tenant_id (withTenant); the vendor
-- side keys off app.vendor_id (withVendor). Only one of the two is ever set in
-- a given transaction, which is why the WITH CHECK also pins each side's
-- inserts to itself: a vendor cannot conjure a connection naming a workspace it
-- isn't acting for, and a coordinator cannot name a vendor id it doesn't hold.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE vendor_connection ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE vendor_connection FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY vendor_connection_party_isolation ON vendor_connection
             USING (
               tenant_id = current_setting(''app.tenant_id'', true)
               OR vendor_id = current_setting(''app.vendor_id'', true)
             )
             WITH CHECK (
               tenant_id = current_setting(''app.tenant_id'', true)
               OR vendor_id = current_setting(''app.vendor_id'', true)
             )';
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_connection" TO freehold_app;
