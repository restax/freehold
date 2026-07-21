-- AlterTable
ALTER TABLE "vendor_ad" ADD COLUMN     "last_renewal_email_at" TIMESTAMP(3),
ADD COLUMN     "renewal_emails_sent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renewal_token" TEXT,
ADD COLUMN     "renewal_unsubscribed_at" TIMESTAMP(3),
ADD COLUMN     "trial_ends_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_ad_renewal_token_key" ON "vendor_ad"("renewal_token");

