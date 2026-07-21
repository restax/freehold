-- CreateTable
CREATE TABLE "vendor_order_message" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_id" TEXT,
    "order_id" TEXT NOT NULL,
    "author_kind" "OrderActor" NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "body" TEXT NOT NULL,
    "via_email" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_order_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_order_message_tenant_id_order_id_createdAt_idx" ON "vendor_order_message"("tenant_id", "order_id", "createdAt");

-- AddForeignKey
ALTER TABLE "vendor_order_message" ADD CONSTRAINT "vendor_order_message_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "vendor_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Two-sided RLS, the same pattern as vendor_order_event: the coordinator side
-- keys off app.tenant_id (withTenant), a registered vendor off app.vendor_id
-- (withVendor). An emailed-vendor message has a null vendor_id and is reached
-- through the tenant scope its capability link resolves to.
ALTER TABLE "vendor_order_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_order_message" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vendor_order_message_party_isolation" ON "vendor_order_message"
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    OR vendor_id = current_setting('app.vendor_id', true)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_order_message" TO freehold_app;
