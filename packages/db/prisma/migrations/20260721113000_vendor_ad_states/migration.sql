-- CreateTable
CREATE TABLE "vendor_ad_state" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ad_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_ad_state_state_idx" ON "vendor_ad_state"("state");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_ad_state_ad_id_state_key" ON "vendor_ad_state"("ad_id", "state");

-- AddForeignKey
ALTER TABLE "vendor_ad_state" ADD CONSTRAINT "vendor_ad_state_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "vendor_ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No RLS: vendor-owned root table, app-scoped like vendor_ad.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_ad_state" TO freehold_app;
