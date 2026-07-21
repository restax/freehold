-- CreateEnum
CREATE TYPE "VendorOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'SCHEDULED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPlacedBy" AS ENUM ('TC', 'CLIENT');

-- CreateEnum
CREATE TYPE "OrderActor" AS ENUM ('TC', 'VENDOR', 'CLIENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "vendor_order" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "transaction_id" TEXT NOT NULL,
    "connection_id" TEXT,
    "type" TEXT NOT NULL,
    "status" "VendorOrderStatus" NOT NULL DEFAULT 'SENT',
    "details" TEXT,
    "due_date" DATE,
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "missed_at" TIMESTAMP(3),
    "placed_by" "OrderPlacedBy" NOT NULL DEFAULT 'TC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_order_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "order_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3),
    "actor" "OrderActor" NOT NULL DEFAULT 'TC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_order_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_order_tenant_id_transaction_id_idx" ON "vendor_order"("tenant_id", "transaction_id");

-- CreateIndex
CREATE INDEX "vendor_order_vendor_id_idx" ON "vendor_order"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_order_event_tenant_id_order_id_idx" ON "vendor_order_event"("tenant_id", "order_id");

-- AddForeignKey
ALTER TABLE "vendor_order" ADD CONSTRAINT "vendor_order_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order" ADD CONSTRAINT "vendor_order_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order" ADD CONSTRAINT "vendor_order_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order_event" ADD CONSTRAINT "vendor_order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "vendor_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security, same two-sided pattern as vendor_connection: the
-- coordinator side keys off app.tenant_id (withTenant), the vendor side off
-- app.vendor_id (withVendor). An order with a null vendor_id (emailed to an
-- unregistered vendor) is visible only to the coordinator, which is correct.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_order','vendor_order_event'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I
         USING (
           tenant_id = current_setting(''app.tenant_id'', true)
           OR vendor_id = current_setting(''app.vendor_id'', true)
         )
         WITH CHECK (
           tenant_id = current_setting(''app.tenant_id'', true)
           OR vendor_id = current_setting(''app.vendor_id'', true)
         )',
      t || '_party_isolation', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_order" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_order_event" TO freehold_app;
