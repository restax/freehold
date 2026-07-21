-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REJECTED');

-- CreateTable
CREATE TABLE "vendor_ad" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "period_end" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_ad_status_idx" ON "vendor_ad"("status");

-- CreateIndex
CREATE INDEX "vendor_ad_vendor_id_idx" ON "vendor_ad"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_ad_stripe_subscription_id_idx" ON "vendor_ad"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "vendor_ad" ADD CONSTRAINT "vendor_ad_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- vendor_ad has NO RLS: like vendor and vendor_user it's a vendor-owned root
-- table with no tenant. The app scopes it — the vendor manages their own ad,
-- operators moderate, and placement reads only ACTIVE ads.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_ad" TO freehold_app;
