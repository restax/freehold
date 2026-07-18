-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "plan_tier" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "seat_limit" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT;
